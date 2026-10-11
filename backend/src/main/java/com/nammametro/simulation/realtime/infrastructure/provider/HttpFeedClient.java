package com.nammametro.simulation.realtime.infrastructure.provider;

import com.nammametro.simulation.realtime.application.ProviderException;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;

/**
 * The one HTTP client every remote provider fetches through: bounded connect/request timeouts, a
 * response-size cap (a misbehaving feed can't exhaust the heap — see the roster-bound fix in this
 * service's history), and error messages that name the host and path but never the query string or
 * headers, where API keys live.
 */
public class HttpFeedClient {

    static final int MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
    private static final String USER_AGENT = "NammaMetroDigitalTwin/1.0";

    private final HttpClient client;

    public HttpFeedClient() {
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public byte[] get(String url, String accept, String authHeaderName, String authHeaderValue, Duration timeout)
            throws ProviderException {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new ProviderException("Invalid feed URL");
        }
        String where = redacted(uri);

        HttpRequest.Builder request = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("User-Agent", USER_AGENT)
                .header("Accept", accept)
                .GET();
        if (authHeaderName != null && !authHeaderName.isBlank() && authHeaderValue != null && !authHeaderValue.isBlank()) {
            request.header(authHeaderName, authHeaderValue);
        }

        HttpResponse<InputStream> response;
        try {
            response = client.send(request.build(), HttpResponse.BodyHandlers.ofInputStream());
        } catch (HttpTimeoutException e) {
            throw new ProviderException("Timed out after %ds fetching %s".formatted(timeout.toSeconds(), where));
        } catch (IOException e) {
            throw new ProviderException("Could not reach %s (%s)".formatted(where, e.getClass().getSimpleName()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProviderException("Interrupted fetching " + where);
        }

        try (InputStream body = response.body()) {
            if (response.statusCode() / 100 != 2) {
                throw new ProviderException("HTTP %d from %s".formatted(response.statusCode(), where));
            }
            byte[] bytes = body.readNBytes(MAX_RESPONSE_BYTES + 1);
            if (bytes.length > MAX_RESPONSE_BYTES) {
                throw new ProviderException("Response from %s exceeds %d MB".formatted(where, MAX_RESPONSE_BYTES / (1024 * 1024)));
            }
            return bytes;
        } catch (IOException e) {
            throw new ProviderException("Failed reading response from %s (%s)".formatted(where, e.getClass().getSimpleName()));
        }
    }

    /** scheme://host/path — no user-info, no query, no fragment. */
    static String redacted(URI uri) {
        return "%s://%s%s".formatted(uri.getScheme(), uri.getHost(), uri.getPath() == null ? "" : uri.getPath());
    }
}
