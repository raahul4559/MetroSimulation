package com.nammametro.simulation.metro.infrastructure.config;

import com.nammametro.simulation.metro.infrastructure.loader.MetroDataLoader;
import com.nammametro.simulation.metro.infrastructure.loader.MetroNetworkAssembler;
import com.nammametro.simulation.metro.network.MetroNetwork;
import com.nammametro.simulation.metro.network.NetworkValidationResult;
import com.nammametro.simulation.metro.network.ValidationIssue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Builds the {@link MetroNetwork} singleton once at startup from the bundled dataset and fails
 * fast — refusing to start the application — if it doesn't validate. Swapping the dataset (see
 * {@code data/README.md}) re-runs this on the next restart.
 */
@Configuration
public class MetroNetworkConfig {

    private static final Logger log = LoggerFactory.getLogger(MetroNetworkConfig.class);

    @Bean
    public MetroNetwork metroNetwork(MetroDataLoader dataLoader) {
        MetroNetwork network = new MetroNetworkAssembler().assemble(dataLoader.load());

        NetworkValidationResult result = network.validate();
        for (ValidationIssue warning : result.warnings()) {
            log.warn("Metro network dataset warning: {}", warning);
        }

        if (result.hasErrors()) {
            String details = String.join("\n  - ", result.errors().stream().map(ValidationIssue::toString).toList());
            throw new IllegalStateException(
                    "Metro network dataset failed validation with %d error(s):\n  - %s"
                            .formatted(result.errors().size(), details));
        }

        log.info("Metro network loaded: {} stations, {} lines, {} tracks, {} interchange(s)",
                network.allStations().size(), network.allLines().size(), network.allTracks().size(),
                network.getInterchanges().size());

        return network;
    }
}
