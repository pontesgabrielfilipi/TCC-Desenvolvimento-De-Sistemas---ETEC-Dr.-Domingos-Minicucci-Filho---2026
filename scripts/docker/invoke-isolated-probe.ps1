# Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
# Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

# Requer Docker Desktop ativo. Nunca utiliza compose down, prune nem containers por prefixo.
[CmdletBinding()]
param(
    [switch]$FailAfterStart,
    [switch]$Keep,
    [ValidatePattern('^[a-f0-9]{32}$')][string]$Recover
)

$ErrorActionPreference = 'Stop'
$script:JournalDirectory = Join-Path $PSScriptRoot '.isolation-runs'
$script:ComposeFile = Join-Path $PSScriptRoot 'isolated-probe.compose.yml'

function Invoke-Docker([string[]]$Arguments) {
    # O Windows PowerShell 5.1 trata o stderr de progresso do Compose como NativeCommandError
    # quando ErrorActionPreference=Stop, mesmo com exit 0.
    $output = @(& docker @Arguments)
    if ($LASTEXITCODE -ne 0) {
        throw "Docker falhou (exit=$LASTEXITCODE): docker $($Arguments -join ' ') $($output -join ' ')"
    }
    return $output
}

function Save-Run($record) {
    $path = Join-Path $script:JournalDirectory "$($record.Id).json"
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $path -Encoding utf8
}

function Get-Resources([string]$id) {
    return @{
        Containers = @((Invoke-Docker -Arguments @('ps', '-aq', '--filter', "label=org.agerp.isolation.run=$id")) | Where-Object { $_ })
        Networks = @((Invoke-Docker -Arguments @('network', 'ls', '-q', '--filter', "label=org.agerp.isolation.run=$id")) | Where-Object { $_ })
        Volumes = @((Invoke-Docker -Arguments @('volume', 'ls', '-q', '--filter', "label=org.agerp.isolation.run=$id")) | Where-Object { $_ })
    }
}

function Assert-Owned([string]$kind, [string]$resourceId, $record) {
    $args = switch ($kind) {
        Containers { @('inspect', $resourceId) }
        Networks { @('network', 'inspect', $resourceId) }
        Volumes { @('volume', 'inspect', $resourceId) }
    }
    $details = @(Invoke-Docker $args) -join "`n"
    $data = @($details | ConvertFrom-Json)[0]
    $labels = if ($kind -eq 'Containers') { $data.Config.Labels } else { $data.Labels }
    if ($labels.'org.agerp.isolation.run' -cne $record.Id -or
        $labels.'org.agerp.isolation.role' -cne 'smoke') {
        throw "Recurso $kind/$resourceId sem labels de propriedade exatas; nao remover."
    }
    if ($kind -eq 'Containers' -and $labels.'com.docker.compose.project' -cne $record.Project) {
        throw "Container $resourceId nao pertence ao projeto temporario $($record.Project)."
    }
}

function Clear-Owned($record) {
    $resources = Get-Resources $record.Id
    # Congela os alvos antes de qualquer remoção; cada ID e suas labels são validados.
    foreach ($kind in @('Containers', 'Networks', 'Volumes')) {
        foreach ($resourceId in @($resources[$kind])) {
            Assert-Owned $kind $resourceId $record
        }
    }
    foreach ($id in @($resources.Containers)) { Invoke-Docker -Arguments @('rm', '-f', $id) | Out-Null }
    foreach ($id in @($resources.Networks)) { Invoke-Docker -Arguments @('network', 'rm', $id) | Out-Null }
    foreach ($id in @($resources.Volumes)) { Invoke-Docker -Arguments @('volume', 'rm', $id) | Out-Null }
    $left = Get-Resources $record.Id
    if ($left.Containers.Count + $left.Networks.Count + $left.Volumes.Count -ne 0) {
        throw 'A limpeza nao ficou completa. Consulte o diario e rode -Recover <Id>.'
    }
    $record.State = 'cleaned'
    Save-Run $record
    Write-Host "Limpeza confirmada para $($record.Id): 0 containers, 0 redes, 0 volumes."
}

New-Item -ItemType Directory -Path $script:JournalDirectory -Force | Out-Null

if ($Recover) {
    $file = Join-Path $script:JournalDirectory "$Recover.json"
    if (-not (Test-Path -LiteralPath $file)) { throw 'Diario de execucao nao encontrado; recuperacao recusada.' }
    $record = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if ($record.Id -cne $Recover -or $record.Project -cne "agerp-it-$($Recover.Substring(0,12))") {
        throw 'Diario incoerente; recuperacao recusada.'
    }
    Clear-Owned $record
    return
}

$runId = [guid]::NewGuid().ToString('N')
$project = "agerp-it-$($runId.Substring(0,12))"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
try { $port = $listener.LocalEndpoint.Port } finally { $listener.Stop() }
$record = [pscustomobject]@{
    Id = $runId
    Project = $project
    Port = $port
    StartedUtc = [DateTime]::UtcNow.ToString('o')
    State = 'allocated'
    Resources = $null
}
$env:ISOLATION_RUN_ID = $runId
$env:ISOLATION_PORT = [string]$port
$env:ISOLATION_DB_PASSWORD = [guid]::NewGuid().ToString('N')
$compose = @('compose', '--project-directory', $PSScriptRoot, '-f', $script:ComposeFile, '-p', $project)
$failed = $false
try {
    $existing = Get-Resources $runId
    if ($existing.Containers.Count + $existing.Networks.Count + $existing.Volumes.Count -ne 0) {
        throw 'ID ja utilizado; nao reutilizar recursos existentes.'
    }
    Save-Run $record # Gravado ANTES da criacao: permite -Recover apos encerramento abrupto.
    Invoke-Docker ($compose + @('up', '-d', '--no-build', '--wait', '--wait-timeout', '90')) | Out-Null
    $record.Resources = Get-Resources $runId
    $record.State = 'running'
    Save-Run $record
    if ($record.Resources.Containers.Count -ne 1 -or
        $record.Resources.Networks.Count -ne 1 -or $record.Resources.Volumes.Count -ne 1) {
        throw 'Inventario isolado inesperado; verificar IDs e labels.'
    }
    # Testa a conexão sem registrar credenciais nem usar o banco principal.
    Invoke-Docker -Arguments @('exec', $record.Resources.Containers[0], 'pg_isready', '-U', 'probe', '-d', 'probe') | Out-Null
    Write-Host "Teste PG16 isolado aprovado; execucao $runId, porta localhost:$port."
    if ($FailAfterStart) { throw 'FALHA_CONTROLADA_APOS_START' }
} catch {
    $failed = $true
    $record | Add-Member -NotePropertyName LastError -NotePropertyValue $_.Exception.Message -Force
    Save-Run $record
    Write-Warning $_.Exception.Message
} finally {
    Remove-Item Env:ISOLATION_DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:ISOLATION_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:ISOLATION_RUN_ID -ErrorAction SilentlyContinue
    if ($Keep -and -not $failed) {
        $record.State = 'kept'
        Save-Run $record
        Write-Host "Preservado por -Keep; recuperar: .\scripts\docker\invoke-isolated-probe.ps1 -Recover $runId"
    } else {
        try { Clear-Owned $record } catch { $failed = $true; Write-Warning "Limpeza incompleta: $($_.Exception.Message)" }
    }
}
if ($failed) { throw "Execucao isolada falhou: $runId (diario: $script:JournalDirectory)" }
