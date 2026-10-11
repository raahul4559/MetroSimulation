package com.nammametro.simulation.realtime.application;

/** A provider couldn't produce data — network failure, non-2xx response, unparseable payload,
 * missing configuration. The message is shown in the health panel, so it must never contain
 * credentials. */
public class ProviderException extends Exception {

    public ProviderException(String message) {
        super(message);
    }

    public ProviderException(String message, Throwable cause) {
        super(message, cause);
    }
}
