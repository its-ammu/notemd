import React, { useState } from 'react';
import { DoodleBoombox, DoodleMoon, DoodleNote } from '../../shared/components/Doodles';
import CustomRadioDialog from './CustomRadioDialog';
import cassetteImg from '../../assets/cassette.png';

// Sleep timer cycles Off -> 15 -> 30 -> 60 -> Off.
function nextSleepStep(mins) {
  if (!mins) return 15;
  if (mins === 15) return 30;
  if (mins === 30) return 60;
  return null;
}

export default function RadioPane({ radio, onStartFocus, screenRef }) {
  const {
    stations, station, playing, connecting, playerReady,
    volume, setVolume, sleepMins, setSleepMinutes,
    toggle, selectStation,
    addCustomStation, updateCustomStation, deleteCustomStation,
  } = radio;

  const [dialog, setDialog] = useState(null); // null | { mode: 'add' } | { mode: 'edit', station }

  const loading = !playerReady; // YouTube player still warming up
  const status = connecting
    ? 'tuning in…'
    : loading ? 'warming up…' : playing ? 'on air' : 'paused';

  const handleSave = (data) => {
    if (dialog?.mode === 'edit') {
      updateCustomStation(dialog.station.id, data);
    } else {
      const entry = addCustomStation(data);
      if (playing || connecting) selectStation(entry.id);
    }
  };

  const handleDelete = (s, e) => {
    e.stopPropagation();
    if (!confirm(`Remove "${s.name}" from your custom radios?`)) return;
    deleteCustomStation(s.id);
  };

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
              className={'nmd-radio-play' + (loading ? ' loading' : '')}
              onClick={toggle}
              disabled={loading}
              aria-label={loading ? 'Loading player' : playing || connecting ? 'Pause' : 'Play'}
              title={loading ? 'Player is loading — hang on…' : undefined}
            >
              {loading ? (
                <span className="nmd-radio-spinner" aria-hidden="true" />
              ) : playing || connecting ? (
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

        <div className="nmd-radio-rack">
          <div className="nmd-radio-rack-label">tapes</div>
          <div className="nmd-radio-wall">
            {stations.map((s) => {
              const active = s.id === station.id;
              return (
                <div
                  key={s.id}
                  className={'nmd-radio-cassette-wrap' + (s.custom ? ' custom' : '')}
                >
                  <button
                    type="button"
                    className={'nmd-radio-cassette' + (active ? ' active' : '') + (active && playing ? ' playing' : '') + (s.custom ? ' custom' : '')}
                    onClick={() => selectStation(s.id)}
                  >
                    <img className="nmd-radio-cassette-art" src={cassetteImg} alt="" aria-hidden="true" draggable="false" />
                    <svg className="nmd-radio-cassette-ring" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M16 13 C80 7 220 8 285 14 C291 60 292 140 286 187 C220 193 80 192 15 186 C9 140 8 60 14 13 Z" />
                      <path d="M20 9 C90 5 215 6 280 10" opacity="0.5" />
                    </svg>
                    <span className="nmd-radio-cassette-label">
                      <span className="nmd-radio-cassette-name">{s.name}</span>
                      {s.by && <span className="nmd-radio-cassette-by">{s.by}</span>}
                    </span>
                  </button>
                  {s.custom && (
                    <div className="nmd-radio-cassette-actions">
                      <button
                        type="button"
                        className="nmd-radio-cassette-act"
                        title="Edit"
                        aria-label={`Edit ${s.name}`}
                        onClick={(e) => { e.stopPropagation(); setDialog({ mode: 'edit', station: s }); }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      </button>
                      <button
                        type="button"
                        className="nmd-radio-cassette-act danger"
                        title="Delete"
                        aria-label={`Delete ${s.name}`}
                        onClick={(e) => handleDelete(s, e)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="nmd-radio-add-btn"
            onClick={() => setDialog({ mode: 'add' })}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Custom radio
          </button>
        </div>
      </div>


      {dialog && (
        <CustomRadioDialog
          station={dialog.mode === 'edit' ? dialog.station : null}
          onSave={handleSave}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
