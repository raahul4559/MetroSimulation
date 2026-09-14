package com.nammametro.simulation.trainsim.domain.model;

/**
 * A passenger's lifecycle. {@code BOARDING} and {@code ALIGHTING} are one-tick transitional states
 * — set by {@code PassengerBoardingHandler} the tick a train is {@code AT_STATION}, resolved to
 * their resting state ({@code ON_TRAIN}, or {@code COMPLETED}/{@code TRANSFER}) at the very start of
 * that handler's next call — so a client polling state mid-transition can actually observe them,
 * the same way {@code TrainStatus#ARRIVING}/{@code DEPARTING} are real, briefly-held states rather
 * than instantaneous edges.
 */
public enum PassengerStatus {
    WAITING,
    BOARDING,
    ON_TRAIN,
    ALIGHTING,
    TRANSFER,
    COMPLETED
}
