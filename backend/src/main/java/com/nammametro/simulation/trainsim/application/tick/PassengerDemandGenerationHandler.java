package com.nammametro.simulation.trainsim.application.tick;

import com.nammametro.simulation.metro.domain.model.Station;
import com.nammametro.simulation.metro.domain.model.StationType;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.metro.routing.DijkstraRouteFinder;
import com.nammametro.simulation.metro.routing.Route;
import com.nammametro.simulation.trainsim.application.TickContext;
import com.nammametro.simulation.trainsim.application.TickHandler;
import com.nammametro.simulation.trainsim.application.TickResult;
import com.nammametro.simulation.trainsim.domain.model.DemandProfile;
import com.nammametro.simulation.trainsim.domain.model.Passenger;
import com.nammametro.simulation.trainsim.domain.model.PassengerStatus;
import com.nammametro.simulation.trainsim.domain.model.SimulationState;

import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Spawns new {@link PassengerStatus#WAITING} passengers at stations each tick — configurable
 * demand, not a flat random headcount. Runs third in the pipeline (after {@code TrainDispatcher},
 * before {@code PassengerBoardingHandler}) so a passenger spawned this tick at a station a train is
 * arriving at this same tick can immediately be considered for boarding, rather than always waiting
 * at least one full tick.
 *
 * <p>Each station's expected arrivals this tick is a rate, not a fixed count: a base hourly rate
 * that varies by {@link StationType} (interchanges attract more riders than a regular stop, a
 * terminus more than a regular mid-line station), scaled by the active {@link DemandProfile}'s
 * multiplier (itself either resolved automatically from the simulated clock's hour-of-day, or
 * pinned by config — see {@code EngineSettings}) and the engine's global
 * {@code demandMultiplier} knob. The actual count drawn each tick is a Poisson sample of that rate
 * (Knuth's algorithm, seeded from {@link TickContext#random()}) — deterministic given the seed,
 * varies tick to tick the way real arrivals do, and is never "N completely random passengers."
 *
 * <p>Each spawned passenger's destination is itself a weighted random pick — using the same
 * per-{@link StationType} weights as origin generation, since a station attractive as an origin
 * (an interchange, a terminus) is equally attractive as a destination — routed once via
 * {@link DijkstraRouteFinder}, never recomputed.
 */
public class PassengerDemandGenerationHandler implements TickHandler {

    /** Expected passenger arrivals per hour, by station type — the "demand varies by station" half
     * of the model. Also doubles as each station's weight when picking a random destination. */
    private static final Map<StationType, Double> BASE_HOURLY_RATE = Map.of(
            StationType.REGULAR, 90.0,
            StationType.INTERCHANGE, 240.0,
            StationType.TERMINAL, 150.0
    );

    @Override
    public TickResult handle(SimulationState current, TickContext ctx) {
        long delta = ctx.settings().deltaSecondsFor(current.clock().speed());
        long nowSeconds = current.clock().elapsedSimulationSeconds();
        int hourOfDay = current.clock().currentTime().atZone(ZoneOffset.UTC).getHour();

        DemandProfile profile = ctx.settings().demandProfile().resolve(hourOfDay);
        double profileMultiplier = profile == DemandProfile.CUSTOM ? 1.0 : profile.baseMultiplier();
        double effectiveMultiplier = profileMultiplier * ctx.settings().demandMultiplier();

        List<Station> allStations = ctx.network().allStations();
        Random random = ctx.random();

        List<Passenger> spawned = new ArrayList<>();
        long nextId = nowSeconds * 100_000L + current.clock().currentTick();

        for (Station origin : allStations) {
            double lambda = BASE_HOURLY_RATE.get(origin.type()) / 3600.0 * delta * effectiveMultiplier;
            int count = samplePoisson(lambda, random);

            for (int i = 0; i < count; i++) {
                Station destination = pickDestination(origin, allStations, random);
                if (destination == null) {
                    continue;
                }
                Route route = DijkstraRouteFinder.findRoute(ctx.network(), origin.id(), destination.id());
                List<Long> routeStationIds = route.stations().stream().map(Station::id).toList();
                if (routeStationIds.size() < 2) {
                    continue;
                }

                spawned.add(new Passenger(
                        nextId++, origin.id(), destination.id(), routeStationIds, 0,
                        origin.id(), null, PassengerStatus.WAITING, nowSeconds, null, null));
            }
        }

        if (spawned.isEmpty()) {
            return TickResult.noEvents(current);
        }

        List<Passenger> updated = new ArrayList<>(current.passengers());
        updated.addAll(spawned);

        SimulationState result = current.withPassengers(updated)
                .withPassengerMetrics(current.passengerMetrics().withGenerated(spawned.size()));
        return TickResult.noEvents(result);
    }

    /** Weighted random pick among every station except {@code origin}, weighted by the same
     * per-{@link StationType} rate used for arrival generation. */
    private Station pickDestination(Station origin, List<Station> allStations, Random random) {
        double totalWeight = 0;
        for (Station s : allStations) {
            if (s.id() != origin.id()) {
                totalWeight += BASE_HOURLY_RATE.get(s.type());
            }
        }
        if (totalWeight <= 0) {
            return null;
        }

        double r = random.nextDouble() * totalWeight;
        for (Station s : allStations) {
            if (s.id() == origin.id()) {
                continue;
            }
            r -= BASE_HOURLY_RATE.get(s.type());
            if (r <= 0) {
                return s;
            }
        }
        return null;
    }

    /** Knuth's algorithm: draws a Poisson(lambda)-distributed sample from uniform draws on
     * {@code random}. Deterministic given a seeded {@link Random}. */
    private int samplePoisson(double lambda, Random random) {
        if (lambda <= 0) {
            return 0;
        }
        double l = Math.exp(-lambda);
        int k = 0;
        double p = 1.0;
        do {
            k++;
            p *= random.nextDouble();
        } while (p > l);
        return k - 1;
    }
}
