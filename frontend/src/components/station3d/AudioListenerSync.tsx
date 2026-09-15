"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { audioManager } from "@/lib/audio/AudioManager";

const UPDATE_INTERVAL_SECONDS = 0.25;

/**
 * Keeps the Web Audio PA graph's listener roughly tracking the 3D camera, so the spatial
 * distance/direction to the fixed PA-speaker anchor (see `lib/audio/pa.ts`) actually changes as the
 * operator moves the camera around a station — without this, every announcement would sound
 * identical regardless of where you're standing, defeating the point of the spatial graph.
 * Throttled well below frame rate: this only ever writes a listener position, never touches decoded
 * audio, so it doesn't run afoul of `AudioManager`'s "nothing decodes per frame" invariant.
 */
export function AudioListenerSync() {
  const accumulatorSeconds = useRef(0);
  const forward = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    accumulatorSeconds.current += delta;
    if (accumulatorSeconds.current < UPDATE_INTERVAL_SECONDS) return;
    accumulatorSeconds.current = 0;

    const camera = state.camera;
    camera.getWorldDirection(forward.current);
    audioManager.updateListenerPosition(
      [camera.position.x, camera.position.y, camera.position.z],
      [forward.current.x, forward.current.y, forward.current.z]
    );
  });

  return null;
}
