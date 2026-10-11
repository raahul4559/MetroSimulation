package com.nammametro.simulation.realtime.application;

import com.nammametro.simulation.realtime.domain.MetroState;

/** Out-port: broadcasts each canonical {@link MetroState} to connected clients. */
public interface MetroStatePublisher {

    void publish(MetroState state);
}
