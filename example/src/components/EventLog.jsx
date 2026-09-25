import React, { useRef, useEffect } from 'react';
import './EventLog.css';

function EventLog({ events }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [events]);

  return (
    <div className="event-log-container">
      <h3>📋 Event Log</h3>
      <div className="event-log" ref={logRef}>
        {events.length === 0 ? (
          <div className="log-entry empty">
            <span className="timestamp">--:--:--</span>
            <span className="message info">No events yet</span>
          </div>
        ) : (
          events.map((event, index) => (
            <div key={index} className={`log-entry ${event.type}`}>
              <span className="timestamp">{event.timestamp}</span>
              <span className="message">{event.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EventLog;
