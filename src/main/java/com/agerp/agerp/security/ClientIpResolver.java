package com.agerp.agerp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Uses the socket peer as the trust anchor; never resolves hostnames. */
@Component
public class ClientIpResolver {
    private static final int MAX_HEADER = 2048;
    private static final int MAX_HOPS = 16;
    private final List<Network> trusted;

    public ClientIpResolver(@Value("${agerp.security.trusted-proxies:}") String proxies) {
        trusted = Arrays.stream(proxies.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).map(Network::parse).toList();
    }

    public String resolve(HttpServletRequest request) {
        String peer = request.getRemoteAddr();
        byte[] address = literal(peer);
        if (address == null) return "0.0.0.0";
        if (!isTrusted(address)) return peer;

        // A single supported header format avoids ambiguous precedence and proxy hopping.
        if (request.getHeaders("Forwarded").hasMoreElements()
                || request.getHeaders("X-Real-IP").hasMoreElements()
                || request.getHeaders("CF-Connecting-IP").hasMoreElements()) return peer;
        var headers = request.getHeaders("X-Forwarded-For");
        if (!headers.hasMoreElements()) return peer;
        String chain = headers.nextElement();
        if (headers.hasMoreElements() || chain == null || chain.length() > MAX_HEADER) return peer;
        String[] hops = chain.split(",", -1);
        if (hops.length == 0 || hops.length > MAX_HOPS) return peer;
        List<String> candidates = new ArrayList<>();
        for (String hop : hops) {
            String value = hop.trim();
            if (literal(value) == null) return peer; // invalid chain fails closed
            candidates.add(value);
        }
        for (int i = candidates.size() - 1; i >= 0; i--) {
            byte[] hop = literal(candidates.get(i));
            if (!isTrusted(hop)) return candidates.get(i);
        }
        return candidates.getFirst();
    }

    private boolean isTrusted(byte[] ip) {
        return trusted.stream().anyMatch(n -> n.contains(ip));
    }

    public boolean isTrustedPeer(String peer) {
        byte[] address = literal(peer);
        return address != null && isTrusted(address);
    }

    static byte[] literal(String value) {
        if (value == null || value.isEmpty() || value.length() > 45 || value.contains("%")) return null;
        if (value.indexOf(':') < 0) {
            String[] parts = value.split("\\.", -1);
            if (parts.length != 4) return null;
            byte[] bytes = new byte[4];
            for (int i = 0; i < 4; i++) {
                if (!parts[i].matches("0|[1-9][0-9]{0,2}")) return null;
                int n = Integer.parseInt(parts[i]);
                if (n > 255) return null;
                bytes[i] = (byte) n;
            }
            return bytes;
        }
        if (!value.matches("[0-9a-fA-F:.]+") || value.chars().filter(c -> c == ':').count() < 2) return null;
        try {
            byte[] parsed = InetAddress.getByName(value).getAddress();
            return parsed.length == 16 ? parsed : null;
        } catch (UnknownHostException ex) {
            return null;
        }
    }

    private record Network(byte[] base, int bits) {
        static Network parse(String value) {
            String[] parts = value.split("/", -1);
            if (parts.length > 2) throw new IllegalArgumentException("Invalid trusted proxy CIDR");
            byte[] address = literal(parts[0]);
            if (address == null) throw new IllegalArgumentException("Invalid trusted proxy address");
            int bits = address.length * 8;
            if (parts.length == 2) {
                if (!parts[1].matches("0|[1-9][0-9]{0,2}")) throw new IllegalArgumentException("Invalid CIDR prefix");
                bits = Integer.parseInt(parts[1]);
                if (bits > address.length * 8) throw new IllegalArgumentException("CIDR prefix out of range");
            }
            return new Network(address, bits);
        }

        boolean contains(byte[] ip) {
            if (ip.length != base.length) return false;
            int whole = bits / 8;
            for (int i = 0; i < whole; i++) if (base[i] != ip[i]) return false;
            int remaining = bits % 8;
            return remaining == 0 || ((base[whole] ^ ip[whole]) & (0xff << (8 - remaining))) == 0;
        }
    }
}
