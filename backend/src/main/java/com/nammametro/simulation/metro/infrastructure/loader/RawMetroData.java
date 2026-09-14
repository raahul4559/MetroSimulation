package com.nammametro.simulation.metro.infrastructure.loader;

import com.nammametro.simulation.metro.infrastructure.loader.raw.RawLine;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawStation;
import com.nammametro.simulation.metro.infrastructure.loader.raw.RawTrack;

import java.util.List;

public record RawMetroData(List<RawStation> stations, List<RawLine> lines, List<RawTrack> tracks) {
}
