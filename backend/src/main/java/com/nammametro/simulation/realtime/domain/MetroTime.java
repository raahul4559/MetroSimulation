package com.nammametro.simulation.realtime.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Asia/Kolkata is the canonical timezone of the whole realtime layer. Instants stay instants
 * everywhere (they are unambiguous); this is the one place they are turned into IST wall-clock
 * concepts — the service day, and seconds past that service day's midnight.
 */
public final class MetroTime {

    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private MetroTime() {
    }

    /** The service day {@code instant} belongs to: before {@code rollover} IST it is still the
     * previous calendar day's service (a 00:30 train ran on yesterday's timetable). */
    public static LocalDate serviceDay(Instant instant, LocalTime rollover) {
        ZonedDateTime ist = instant.atZone(ZONE);
        return ist.toLocalTime().isBefore(rollover) ? ist.toLocalDate().minusDays(1) : ist.toLocalDate();
    }

    /** Seconds since midnight IST of {@code serviceDay} — past 86400 for after-midnight instants. */
    public static long secondsIntoServiceDay(Instant instant, LocalDate serviceDay) {
        return instant.getEpochSecond() - serviceDay.atStartOfDay(ZONE).toEpochSecond();
    }

    public static Instant atServiceDaySeconds(LocalDate serviceDay, long seconds) {
        return serviceDay.atStartOfDay(ZONE).toInstant().plusSeconds(seconds);
    }

    /** "05:30" / "24:15" — GTFS-style, hours may exceed 23 for after-midnight service. */
    public static String formatServiceTime(long secondsIntoServiceDay) {
        long hours = secondsIntoServiceDay / 3600;
        long minutes = (secondsIntoServiceDay % 3600) / 60;
        return "%02d:%02d".formatted(hours, minutes);
    }

    /** Parses "HH:mm" or "HH:mm:ss", hours 0..47. */
    public static int parseServiceTime(String value) {
        String[] parts = value.trim().split(":");
        if (parts.length < 2 || parts.length > 3) {
            throw new IllegalArgumentException("Expected HH:mm or HH:mm:ss, got '" + value + "'");
        }
        int hours = Integer.parseInt(parts[0]);
        int minutes = Integer.parseInt(parts[1]);
        int seconds = parts.length == 3 ? Integer.parseInt(parts[2]) : 0;
        if (hours < 0 || hours > 47 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
            throw new IllegalArgumentException("Service time out of range: '" + value + "'");
        }
        return hours * 3600 + minutes * 60 + seconds;
    }
}
