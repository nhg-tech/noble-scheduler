import ScheduleSummary from './ScheduleSummary';
import TaskLibrary from './TaskLibrary';

export default function RightPanel({ onCreateCustom }) {
  return (
    <div style={{
      width: 220,
      minWidth: 220,
      maxWidth: 220,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid var(--gray-light)',
      background: '#fff',
      height: '100%',
      overflow: 'hidden',
    }}>
      <ScheduleSummary />
      <div style={{ borderTop: '2px solid var(--gray-light)', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TaskLibrary onCreateCustom={onCreateCustom} />
      </div>
    </div>
  );
}
