package com.nammametro.simulation.api.rest;

import com.nammametro.simulation.domain.exception.InvalidSimulationStateException;
import com.nammametro.simulation.domain.exception.ResourceNotFoundException;
import com.nammametro.simulation.metro.domain.exception.RouteNotFoundException;
import org.apache.catalina.connector.ClientAbortException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(RouteNotFoundException.class)
    public ProblemDetail handleRouteNotFound(RouteNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(InvalidSimulationStateException.class)
    public ProblemDetail handleInvalidState(InvalidSimulationStateException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Validation failed: " + ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleIllegalArgument(IllegalArgumentException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNoResourceFound(NoResourceFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "No endpoint found for this request.");
    }

    /**
     * The client (browser tab closed/refreshed, network drop) went away before the response
     * finished. Not an application error — logging it at ERROR and then trying to write a JSON
     * body to the now-broken connection was itself throwing a second exception (see
     * {@link #handleMessageNotWritable}); this handler returns no body so Spring MVC skips message
     * conversion entirely instead of attempting — and failing — to write to a dead socket.
     */
    @ExceptionHandler({ClientAbortException.class, AsyncRequestNotUsableException.class})
    public ProblemDetail handleClientDisconnect(Exception ex) {
        log.debug("Client disconnected before the response could be completed: {}", ex.getMessage());
        return null;
    }

    /**
     * Jackson wraps a broken-pipe/client-abort hit mid-serialization as
     * {@link HttpMessageNotWritableException} rather than surfacing the underlying
     * {@link ClientAbortException} directly — same client-disconnect case as
     * {@link #handleClientDisconnect}, just one layer deeper, so it gets the same silent treatment
     * rather than falling through to {@link #handleUnexpected} and attempting a second, doomed
     * write to the same dead connection.
     */
    @ExceptionHandler(HttpMessageNotWritableException.class)
    public ProblemDetail handleMessageNotWritable(HttpMessageNotWritableException ex) {
        if (isClientDisconnect(ex)) {
            log.debug("Client disconnected while the response body was being written: {}", ex.getMessage());
            return null;
        }
        return handleUnexpected(ex);
    }

    private static boolean isClientDisconnect(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ClientAbortException || t instanceof AsyncRequestNotUsableException) {
                return true;
            }
        }
        return false;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        String correlationId = UUID.randomUUID().toString();
        log.error("Unhandled exception [correlationId={}]", correlationId, ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
        problem.setProperty("correlationId", correlationId);
        return problem;
    }
}
