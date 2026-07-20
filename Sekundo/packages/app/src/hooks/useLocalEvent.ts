/**
 * Hook: useLocalEvent
 *
 * Coordinates event containers lifecycle: list, load, create, delete,
 * and trigger gap-aware rollover checks.
 */

import { useState, useEffect, useCallback } from 'react';
import type { EventState, Frequency } from '@sekundo/core';
import { eventContainer, rollover } from '@sekundo/core';
import * as storage from '../storage/localStorage';

export function useLocalEvent() {
  const [events, setEvents] = useState<EventState[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshEvents = useCallback(async () => {
    setLoading(true);
    try {
      const ids = await storage.getEventIds();
      const loaded: EventState[] = [];
      for (const id of ids) {
        const state = await storage.loadEventState(id);
        if (state) {
          loaded.push(state);
        }
      }
      setEvents(loaded);
    } catch (e) {
      console.error('[Sekundo] Failed to load events:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const addEvent = async (name: string, frequency: Frequency, skeletonRoots: string[] = []) => {
    const config = eventContainer.createEvent(name, frequency, skeletonRoots);
    const state = eventContainer.createEventState(config);
    await storage.saveEventState(config.id, state);
    
    // Save empty default skeleton registry
    await storage.saveSkeleton(config.id, []);
    
    await refreshEvents();
    return state;
  };

  const updateEventState = async (eventId: string, state: EventState) => {
    await storage.saveEventState(eventId, state);
    await refreshEvents();
  };

  const deleteEventState = async (eventId: string) => {
    await storage.deleteEvent(eventId);
    await refreshEvents();
  };

  const checkAndRunRollover = useCallback(async (eventId: string) => {
    const state = await storage.loadEventState(eventId);
    const skeleton = await storage.loadSkeleton(eventId);
    
    if (state && skeleton) {
      const result = rollover.executeRollover(state, skeleton);
      if (result) {
        // Save rolled over state and cleared skeleton values
        await storage.saveEventState(eventId, result.state);
        await storage.saveSkeleton(eventId, result.skeleton);
        await refreshEvents();
        return result;
      }
    }
    return null;
  }, [refreshEvents]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  return {
    events,
    loading,
    refreshEvents,
    addEvent,
    updateEventState,
    deleteEventState,
    checkAndRunRollover,
  };
}
