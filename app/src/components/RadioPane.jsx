import React from 'react';
import { DoodleBoombox, DoodleMoon, DoodleNote, DoodleSquiggle } from './Doodles';

// Sleep timer cycles Off -> 15 -> 30 -> 60 -> Off.
function nextSleepStep(mins) {
  if (!mins) return 15;
  if (mins === 15) return 30;
  if (mins === 30) return 60;
  return null;
}

export default function RadioPane({ radio, onStartFocus, screenRef }) {
  const {
    stations, station, playing, connecting,
    volume, setVolume, sleepMins, setSleepMinutes,
    toggle, selectStation,
  } = radio;

  const status = connecting ? 'tuning in…' : playing ? 'on air' : 'paused';

  return (
    <div className="nmd-radio">
      <div className="nmd-radio-stage">
        <span className="nmd-radio-margin-note n1"><DoodleNote size={26} /></span>
        <span className="nmd-radio-margin-note n2"><DoodleNote size={18} /></span>
        <span className="nmd-radio-margin-note n3"><DoodleBoombox size={116} playing={playing} /></span>

        <div className="nmd-radio-center">
          {/* In-flow slot the fixed YouTube "TV" (rendered by App) pins itself to */}
          <div className="nmd-radio-screen" ref={screenRef} />
          <div className={'nmd-radio-eq' + (playing ? ' playing' : '')} aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>

          <div className="nmd-radio-now">
            <div className="nmd-radio-station">{station.name}</div>
            <div className={'nmd-radio-status' + (playing ? ' live' : '')}>{status}</div>
          </div>

          <div className="nmd-radio-controls">
            <button
              className="nmd-radio-play"
              onClick={toggle}
              aria-label={playing || connecting ? 'Pause' : 'Play'}
            >
              {playing || connecting ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M9 5.5v13M15 5.5v13" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M8.5 5.8 17.5 12 8.5 18.2 Z" /></svg>
              )}
            </button>
            <input
              className="nmd-radio-vol"
              type="range" min="0" max="1" step="0.05"
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
            <button
              className={'nmd-radio-sleep' + (sleepMins ? ' on' : '')}
              onClick={() => setSleepMinutes(nextSleepStep(sleepMins))}
              title={sleepMins ? `Stops after ${sleepMins} min — click to change` : 'Sleep timer'}
              aria-label="Sleep timer"
            >
              <DoodleMoon size={18} />
              {sleepMins && <span>{sleepMins}m</span>}
            </button>
          </div>

          <button className="nmd-radio-focus" onClick={onStartFocus}>
            start a focus session
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
          </button>
        </div>

        <div className="nmd-radio-wall">
          {stations.map((s, i) => {
            const active = s.id === station.id;
            return (
              <button
                key={s.id}
                className={'nmd-radio-poster p' + i + (active ? ' active' : '')}
                onClick={() => selectStation(s.id)}
              >
                <span className="nmd-radio-poster-name">{s.name}</span>
                {active && <DoodleSquiggle width={84} className="nmd-radio-poster-sq" />}
                <span className="nmd-radio-poster-sub">{s.sub}</span>
                <span className="nmd-radio-poster-by">{s.by}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="nmd-radio-credit">
        24/7 live streams via YouTube — the little screen stays visible, that&apos;s the deal
      </div>
    </div>
  );
}
