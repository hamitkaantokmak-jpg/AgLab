// Read-only playback utilities. No topology traversal or protocol execution.
(function (root) {
  'use strict';
  function createTimeline() {
    let events = [],
      cursor = -1,
      playing = false,
      speed = 1,
      meta = {};
    const copy = (v) => JSON.parse(JSON.stringify(v));
    function freeze(v) {
      if (v && typeof v === 'object') {
        Object.values(v).forEach(freeze);
        Object.freeze(v);
      }
      return v;
    }
    function load(snapshot) {
      if (
        !snapshot ||
        (snapshot.origin !== 'aglab-js' && snapshot.origin !== 'labber') ||
        !Array.isArray(snapshot.events) ||
        snapshot.events.length > 512
      )
        throw Error('Invalid or oversized replay');
      events = freeze(copy(snapshot.events));
      meta = {
        generation: snapshot.generation,
        overflow: snapshot.overflow || 0,
        topologyKey: snapshot.topologyKey,
      };
      cursor = -1;
      playing = false;
    }
    function seek(index) {
      if (!Number.isInteger(index) || index < 0 || index >= events.length)
        throw Error('Invalid replay position');
      cursor = index;
      return events[cursor];
    }
    return Object.freeze({
      load,
      seek,
      forward() {
        return cursor + 1 < events.length ? seek(cursor + 1) : null;
      },
      reset() {
        cursor = -1;
        playing = false;
      },
      play() {
        playing = events.length > 0;
      },
      pause() {
        playing = false;
      },
      speed(value) {
        if (![0.5, 1, 2, 4].includes(value)) throw Error('Invalid playback speed');
        speed = value;
      },
      state() {
        return {
          ...meta,
          cursor,
          playing,
          speed,
          total: events.length,
          event: events[cursor] || null,
        };
      },
      events() {
        return events;
      },
    });
  }
  function matchWire(event, links) {
    if (
      event?.kind !== 'wire' ||
      (event.origin !== 'aglab-js' && event.origin !== 'labber') ||
      !event.edge ||
      !Array.isArray(links)
    )
      return -1;
    const e = event.edge,
      matches = [];
    links.forEach((l, i) => {
      if (
        (l.a === e.a && l.b === e.b && l.portA === e.portA && l.portB === e.portB) ||
        (l.b === e.a && l.a === e.b && l.portB === e.portA && l.portA === e.portB)
      )
        matches.push(i);
    });
    return matches.length === 1 ? matches[0] : -1;
  }
  function interpolate(line, t) {
    if (!line || ![line.x1, line.y1, line.x2, line.y2, t].every(Number.isFinite) || t < 0 || t > 1)
      throw Error('Invalid animation geometry');
    return { x: line.x1 + (line.x2 - line.x1) * t, y: line.y1 + (line.y2 - line.y1) * t };
  }
  const api = Object.freeze({ createTimeline, matchWire, interpolate });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgLabSimulationPlayback = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
