package com.nammametro.simulation.realtime.infrastructure.config;

import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.realtime.application.FeedMapping;
import com.nammametro.simulation.realtime.application.MetroRealtimeProvider;
import com.nammametro.simulation.realtime.application.MetroStateManager;
import com.nammametro.simulation.realtime.application.MetroStatePublisher;
import com.nammametro.simulation.realtime.application.RealtimeSettings;
import com.nammametro.simulation.realtime.application.ServiceCalendar;
import com.nammametro.simulation.realtime.domain.MetroTime;
import com.nammametro.simulation.realtime.domain.Timetable;
import com.nammametro.simulation.realtime.infrastructure.provider.GtfsRealtimeProvider;
import com.nammametro.simulation.realtime.infrastructure.provider.HttpFeedClient;
import com.nammametro.simulation.realtime.infrastructure.provider.OfficialRealtimeProvider;
import com.nammametro.simulation.realtime.infrastructure.provider.ScheduleProvider;
import com.nammametro.simulation.realtime.infrastructure.provider.SimulationProvider;
import com.nammametro.simulation.trainsim.application.TrainSimulationControlUseCase;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Wires the realtime layer. The only place configuration becomes providers; the timetable is
 * validated here, so a malformed one fails at boot with the offending entry named — the same
 * fail-loudly stance {@code MetroNetworkConfig} takes on a bad network dataset.
 */
@Configuration
@EnableConfigurationProperties(RealtimeProperties.class)
public class RealtimeConfig {

    /** The authoritative server clock. Instants are zone-free; the zone is Asia/Kolkata so anything
     * that does ask this clock for local time gets IST. */
    @Bean
    public Clock metroClock() {
        return Clock.system(MetroTime.ZONE);
    }

    @Bean
    public RealtimeSettings realtimeSettings(RealtimeProperties properties) {
        return new RealtimeSettings(properties.staleAfter(), properties.expireAfter(), properties.maxClockSkew(),
                properties.maxSnapDistanceMetres());
    }

    @Bean
    public ServiceCalendar serviceCalendar(RealtimeProperties properties, MetroNetwork network) {
        return new ServiceCalendar(toTimetable(properties.timetable(), network), network);
    }

    @Bean
    public HttpFeedClient httpFeedClient() {
        return new HttpFeedClient();
    }

    @Bean
    public OfficialRealtimeProvider officialRealtimeProvider(RealtimeProperties properties, HttpFeedClient http,
                                                             ObjectMapper objectMapper) {
        RealtimeProperties.Official official = properties.official();
        return new OfficialRealtimeProvider(http, objectMapper, official.url(), official.authHeaderName(),
                official.authHeaderValue(), official.pollInterval(), official.requestTimeout(),
                toMapping(official.mapping()));
    }

    @Bean
    public GtfsRealtimeProvider gtfsRealtimeProvider(RealtimeProperties properties, HttpFeedClient http) {
        RealtimeProperties.Gtfs gtfs = properties.gtfs();
        return new GtfsRealtimeProvider(http, gtfs.vehiclePositionsUrl(), gtfs.tripUpdatesUrl(), gtfs.alertsUrl(),
                gtfs.authHeaderName(), gtfs.authHeaderValue(), gtfs.pollInterval(), gtfs.requestTimeout(),
                toMapping(gtfs.mapping()));
    }

    @Bean
    public ScheduleProvider scheduleProvider(MetroNetwork network, ServiceCalendar calendar) {
        return new ScheduleProvider(network, calendar);
    }

    @Bean
    public SimulationProvider simulationProvider(TrainSimulationControlUseCase simulation, MetroNetwork network) {
        return new SimulationProvider(simulation, network);
    }

    @Bean(initMethod = "start", destroyMethod = "stop")
    public MetroStateManager metroStateManager(Clock metroClock, MetroNetwork network, ServiceCalendar calendar,
                                               RealtimeSettings settings, List<MetroRealtimeProvider> providers,
                                               TrainSimulationControlUseCase simulation,
                                               MetroStatePublisher publisher, RealtimeProperties properties) {
        return new MetroStateManager(metroClock, network, calendar, settings, providers, simulation, publisher,
                properties.mode(), properties.maxBackoff());
    }

    static FeedMapping toMapping(RealtimeProperties.Mapping mapping) {
        if (mapping == null) {
            return FeedMapping.identity();
        }
        return new FeedMapping(mapping.stopIds(), mapping.routeIds(), mapping.directionIds());
    }

    static Timetable toTimetable(RealtimeProperties.Timetable properties, MetroNetwork network) {
        if (properties == null) {
            return Timetable.empty();
        }
        int rolloverSeconds = parse(properties.serviceDayRollover(), "realtime.timetable.service-day-rollover");
        if (rolloverSeconds >= 24 * 3600) {
            throw new IllegalStateException("realtime.timetable.service-day-rollover must be before 24:00");
        }
        LocalTime rollover = LocalTime.ofSecondOfDay(rolloverSeconds);

        Map<String, Timetable.LineTimetable> lines = new HashMap<>();
        if (properties.lines() != null) {
            for (Map.Entry<String, RealtimeProperties.LineDays> entry : properties.lines().entrySet()) {
                String lineCode = entry.getKey().toUpperCase();
                if (network.findLineByCode(lineCode).isEmpty()) {
                    throw new IllegalStateException("realtime.timetable.lines." + entry.getKey()
                            + " is not a line in this network");
                }
                RealtimeProperties.LineDays days = entry.getValue();
                Map<Timetable.DayType, List<Timetable.ServicePeriod>> periods = new EnumMap<>(Timetable.DayType.class);
                put(periods, Timetable.DayType.WEEKDAY, days.weekday(), lineCode);
                put(periods, Timetable.DayType.SATURDAY, days.saturday(), lineCode);
                put(periods, Timetable.DayType.SUNDAY, days.sunday(), lineCode);
                lines.put(lineCode, new Timetable.LineTimetable(periods));
            }
        }
        return new Timetable(properties.source(), rollover,
                properties.holidays() == null ? null : new java.util.HashSet<>(properties.holidays()), lines,
                toExceptions(properties.exceptions(), network));
    }

    private static List<Timetable.ScheduleException> toExceptions(List<RealtimeProperties.Exception> exceptions,
                                                                  MetroNetwork network) {
        if (exceptions == null) {
            return List.of();
        }
        List<Timetable.ScheduleException> converted = new ArrayList<>();
        for (int i = 0; i < exceptions.size(); i++) {
            RealtimeProperties.Exception e = exceptions.get(i);
            String where = "realtime.timetable.exceptions[%d]".formatted(i);
            if (e.date() == null || e.type() == null) {
                throw new IllegalStateException(where + " needs both 'date' and 'type'");
            }
            java.util.Set<String> lineCodes = new java.util.HashSet<>();
            for (String line : e.lines() == null ? List.<String>of() : e.lines()) {
                String code = line.toUpperCase();
                if (network.findLineByCode(code).isEmpty()) {
                    throw new IllegalStateException(where + ".lines: '" + line + "' is not a line in this network");
                }
                lineCodes.add(code);
            }
            List<Timetable.ServicePeriod> periods = new ArrayList<>();
            List<RealtimeProperties.Period> configured = e.periods() == null ? List.of() : e.periods();
            for (int j = 0; j < configured.size(); j++) {
                RealtimeProperties.Period p = configured.get(j);
                String periodWhere = where + ".periods[" + j + "]";
                if (p.from() == null || p.to() == null) {
                    throw new IllegalStateException(periodWhere + " needs both 'from' and 'to'");
                }
                try {
                    periods.add(new Timetable.ServicePeriod(parse(p.from(), periodWhere + ".from"),
                            parse(p.to(), periodWhere + ".to"), p.headwaySeconds()));
                } catch (IllegalArgumentException ex) {
                    throw new IllegalStateException(periodWhere + ": " + ex.getMessage(), ex);
                }
            }
            try {
                converted.add(new Timetable.ScheduleException(e.date(), lineCodes, e.type(), e.runAs(), periods, e.note()));
            } catch (IllegalArgumentException ex) {
                throw new IllegalStateException(where + ": " + ex.getMessage(), ex);
            }
        }
        return converted;
    }

    private static void put(Map<Timetable.DayType, List<Timetable.ServicePeriod>> target, Timetable.DayType dayType,
                            List<RealtimeProperties.Period> periods, String lineCode) {
        if (periods == null || periods.isEmpty()) {
            return;
        }
        List<Timetable.ServicePeriod> converted = new ArrayList<>();
        for (int i = 0; i < periods.size(); i++) {
            RealtimeProperties.Period p = periods.get(i);
            String where = "realtime.timetable.lines.%s.%s[%d]".formatted(lineCode, dayType.name().toLowerCase(), i);
            if (p.from() == null || p.to() == null) {
                throw new IllegalStateException(where + " needs both 'from' and 'to'");
            }
            try {
                converted.add(new Timetable.ServicePeriod(parse(p.from(), where + ".from"), parse(p.to(), where + ".to"),
                        p.headwaySeconds()));
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException(where + ": " + e.getMessage(), e);
            }
        }
        target.put(dayType, converted);
    }

    private static int parse(String value, String where) {
        try {
            return MetroTime.parseServiceTime(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(where + ": " + e.getMessage(), e);
        }
    }
}
