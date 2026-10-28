# Copyright 2026 Gabriel Filipi Pontes & André Correia Gomes da Silva.
# Licença proprietária. Consulte o arquivo LICENSE na raiz do projeto.

# Confere a estrutura de um XLSX do AGERP sem carregar todas as linhas em memória.
# Para provar ausência de perdas ou duplicações, informe também os IDs da consulta
# de origem na mesma ordenação do relatório.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Path,
    [ValidateRange(1,9223372036854775807)][long]$ExpectedDataRows = 1048576,
    [string]$ExpectedOrderedIdsPath,
    # Valida apenas o leitor com fixtures pequenas; não comprova o limite real.
    [ValidateRange(2,1048576)][int]$MaxRowsPerSheet = 1048576
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolved = (Resolve-Path -LiteralPath $Path).Path
$expectedIds = $null
$archive = $null
try {
    if ($ExpectedOrderedIdsPath) {
        $idsPath = (Resolve-Path -LiteralPath $ExpectedOrderedIdsPath).Path
        $expectedIds = [System.IO.StreamReader]::new($idsPath)
    }
    $archive = [System.IO.Compression.ZipFile]::OpenRead($resolved)
    $sheets = @($archive.Entries | Where-Object { $_.FullName -match '^xl/worksheets/sheet([0-9]+)\.xml$' } |
        Sort-Object { [int]([regex]::Match($_.FullName, 'sheet([0-9]+)\.xml').Groups[1].Value) })
    if ($sheets.Count -lt 4) { throw "Esperadas Informacoes, Dados 1/2 e Totais; encontradas $($sheets.Count) abas" }

    $workbookEntry = $archive.GetEntry('xl/workbook.xml')
    if ($null -eq $workbookEntry) { throw 'xl/workbook.xml ausente' }
    $wbStream = $workbookEntry.Open()
    $wbReader = [System.Xml.XmlReader]::Create($wbStream, [System.Xml.XmlReaderSettings]@{
        DtdProcessing = 'Prohibit'; XmlResolver = $null
    })
    try {
        $workbook = [System.Xml.XmlDocument]::new()
        $workbook.XmlResolver = $null
        $workbook.Load($wbReader)
    } finally { $wbReader.Dispose(); $wbStream.Dispose() }
    $names = @($workbook.SelectNodes('//*[local-name()="sheet"]') | ForEach-Object { $_.GetAttribute('name') })
    $informacoes = 'Informa' + [char]0x00E7 + [char]0x00F5 + 'es'
    if ($names.Count -ne $sheets.Count -or $names[0] -cne $informacoes -or $names[-1] -cne 'Totais') {
        throw "Ordem/nome de abas incorretos: $($names -join ', ')"
    }
    for ($i = 1; $i -lt $names.Count - 1; $i++) {
        if ($names[$i] -cne "Dados $i") { throw "Aba $i deveria ser Dados $i; recebida '$($names[$i])'" }
    }

    $header = $null
    $total = [long]0
    for ($i = 1; $i -lt $sheets.Count - 1; $i++) {
        $stream = $sheets[$i].Open()
        $xml = [System.Xml.XmlReader]::Create($stream, [System.Xml.XmlReaderSettings]@{
            DtdProcessing = 'Prohibit'; XmlResolver = $null; IgnoreWhitespace = $true
        })
        try {
            $rowCount = [long]0
            $hasFilter = $false
            $hasFreeze = $false
            while (-not $xml.EOF) {
                if ($xml.NodeType -eq [System.Xml.XmlNodeType]::Element) {
                    if ($xml.LocalName -eq 'pane' -and $xml.GetAttribute('state') -eq 'frozen') {
                        $hasFreeze = $true
                    }
                    if ($xml.LocalName -eq 'autoFilter' -and $xml.GetAttribute('ref') -match '^A1:[A-Z]+1$') {
                        $hasFilter = $true
                    }
                    if ($xml.LocalName -eq 'row') {
                        $rowCount++
                        $number = [long]$xml.GetAttribute('r')
                        if ($number -ne $rowCount) { throw "Linha ausente/repetida em $($sheets[$i].FullName): esperado $rowCount, obtido $number" }
                        if ($rowCount -eq 1) {
                            $observedHeader = $xml.ReadOuterXml()
                            if ($observedHeader -notmatch '<c\b') { throw "Cabecalho vazio em $($sheets[$i].FullName)" }
                            if ($null -eq $header) { $header = $observedHeader }
                            elseif ($header -cne $observedHeader) { throw 'Cabecalhos divergentes entre abas de dados' }
                        } elseif ($null -ne $expectedIds) {
                            $row = $xml.ReadOuterXml()
                            $id = [regex]::Match($row, '<c\b(?=[^>]*\br="A[0-9]+")[^>]*>\s*<v>([0-9]+)</v>\s*</c>')
                            if (-not $id.Success) { throw "ID numerico na coluna A nao encontrado: $($sheets[$i].FullName) linha $rowCount" }
                            $expectedId = $expectedIds.ReadLine()
                            if ($null -eq $expectedId -or $id.Groups[1].Value -cne $expectedId.Trim()) {
                                throw "ID de origem divergente: $($sheets[$i].FullName) linha $rowCount, XLSX=$($id.Groups[1].Value), esperado=$expectedId"
                            }
                        } else { $xml.Skip() }
                        continue
                    }
                }
                [void]$xml.Read()
            }
            if (-not $hasFilter -or -not $hasFreeze) { throw "Filtro ou congelamento de cabecalho ausente em $($sheets[$i].FullName)" }
            if ($rowCount -lt 2 -or $rowCount -gt $MaxRowsPerSheet) {
                throw "Quantidade de linhas invalida em $($sheets[$i].FullName): $rowCount"
            }
            if ($i -lt $sheets.Count - 2 -and $rowCount -ne $MaxRowsPerSheet) {
                throw "Aba intermediaria nao esta preenchida: $($sheets[$i].FullName)"
            }
            $dataRows = $rowCount - 1
            $total += $dataRows
            Write-Output "$($sheets[$i].FullName): $dataRows registros, indices/cabecalho/filtro OK"
        } finally { $xml.Dispose(); $stream.Dispose() }
    }
    if ($total -ne $ExpectedDataRows) { throw "Esperados $ExpectedDataRows registros; presentes $total" }
    if ($null -ne $expectedIds -and $null -ne $expectedIds.ReadLine()) {
        throw 'Arquivo de IDs de origem contem registros extras'
    }
    if ($MaxRowsPerSheet -ne 1048576) {
        Write-Output 'SIMULACAO: capacidade reduzida; isto NAO comprova o limite real do Excel.'
    }
    if ($null -eq $expectedIds) {
        Write-Output 'AVISO: sem IDs de origem; contagem e indices de linhas nao provam ausencia de perda/duplicacao dos registros.'
    }
    Write-Output "OK: $total registros, $($sheets.Count - 2) abas de dados, verificacao estrutural concluida."
} finally {
    if ($null -ne $archive) { $archive.Dispose() }
    if ($null -ne $expectedIds) { $expectedIds.Dispose() }
}
