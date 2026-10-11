package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.domain.model.Coordinates;
import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.Track;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Point-on-track math for placing a reported latitude/longitude onto a leg, and the inverse.
 * Uses a local equirectangular approximation — accurate to well under a metre over the few
 * kilometres of one metro leg, and far simpler than geodesics.
 *
 * <p>A leg's polyline is the track's own {@code geometry} when it has one, else the straight line
 * between its stations — the same shape the map draws.
 */
public final class TrackGeometry {

    private static final double METRES_PER_DEGREE_LAT = 110_540;
    private static final double METRES_PER_DEGREE_LNG_AT_EQUATOR = 111_320;

    private TrackGeometry() {
    }

    /** Where {@code point} falls along the leg {@code from -> to}: {@code progress} 0..1 by distance,
     * {@code distanceMetres} the perpendicular distance from the polyline. */
    public record Projection(double progress, double distanceMetres) {
    }

    public static List<Coordinates> polyline(Track track, Station from, Station to) {
        List<Coordinates> points;
        if (track.geometry() != null && track.geometry().size() >= 2) {
            points = new ArrayList<>(track.geometry());
            if (track.fromStationId() != from.id()) {
                Collections.reverse(points);
            }
        } else {
            points = List.of(from.coordinates(), to.coordinates());
        }
        return points;
    }

    public static Projection project(List<Coordinates> polyline, double latitude, double longitude) {
        double originLat = polyline.getFirst().latitude();
        double cosLat = Math.cos(Math.toRadians(originLat));

        double total = 0;
        double bestDistance = Double.MAX_VALUE;
        double bestAlong = 0;
        double px = x(longitude, polyline.getFirst(), cosLat);
        double py = y(latitude, polyline.getFirst());

        for (int i = 0; i < polyline.size() - 1; i++) {
            Coordinates a = polyline.get(i);
            Coordinates b = polyline.get(i + 1);
            double ax = x(a.longitude(), polyline.getFirst(), cosLat);
            double ay = y(a.latitude(), polyline.getFirst());
            double bx = x(b.longitude(), polyline.getFirst(), cosLat);
            double by = y(b.latitude(), polyline.getFirst());
            double dx = bx - ax;
            double dy = by - ay;
            double segmentLength = Math.hypot(dx, dy);
            double t = segmentLength == 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / (segmentLength * segmentLength);
            t = Math.clamp(t, 0, 1);
            double distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            if (distance < bestDistance) {
                bestDistance = distance;
                bestAlong = total + t * segmentLength;
            }
            total += segmentLength;
        }
        double progress = total == 0 ? 0 : bestAlong / total;
        return new Projection(progress, bestDistance);
    }

    /** The point {@code progress} (0..1, by distance) of the way along {@code polyline}. */
    public static Coordinates interpolate(List<Coordinates> polyline, double progress) {
        double cosLat = Math.cos(Math.toRadians(polyline.getFirst().latitude()));
        double[] lengths = new double[polyline.size() - 1];
        double total = 0;
        for (int i = 0; i < lengths.length; i++) {
            Coordinates a = polyline.get(i);
            Coordinates b = polyline.get(i + 1);
            lengths[i] = Math.hypot((b.longitude() - a.longitude()) * cosLat * METRES_PER_DEGREE_LNG_AT_EQUATOR,
                    (b.latitude() - a.latitude()) * METRES_PER_DEGREE_LAT);
            total += lengths[i];
        }
        double target = Math.clamp(progress, 0, 1) * total;
        for (int i = 0; i < lengths.length; i++) {
            if (target <= lengths[i] || i == lengths.length - 1) {
                double t = lengths[i] == 0 ? 0 : Math.clamp(target / lengths[i], 0, 1);
                Coordinates a = polyline.get(i);
                Coordinates b = polyline.get(i + 1);
                return new Coordinates(a.latitude() + (b.latitude() - a.latitude()) * t,
                        a.longitude() + (b.longitude() - a.longitude()) * t);
            }
            target -= lengths[i];
        }
        return polyline.getLast();
    }

    /** Compass bearing (0 = north, clockwise) from {@code a} to {@code b}. */
    public static double bearingDegrees(Coordinates a, Coordinates b) {
        double cosLat = Math.cos(Math.toRadians(a.latitude()));
        double dx = (b.longitude() - a.longitude()) * cosLat;
        double dy = b.latitude() - a.latitude();
        double degrees = Math.toDegrees(Math.atan2(dx, dy));
        return (degrees + 360) % 360;
    }

    private static double x(double longitude, Coordinates origin, double cosLat) {
        return (longitude - origin.longitude()) * cosLat * METRES_PER_DEGREE_LNG_AT_EQUATOR;
    }

    private static double y(double latitude, Coordinates origin) {
        return (latitude - origin.latitude()) * METRES_PER_DEGREE_LAT;
    }
}
