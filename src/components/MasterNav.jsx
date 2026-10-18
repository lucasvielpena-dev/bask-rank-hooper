/** Navegação única do painel Master — mesma linha em todas as telas admin */
const ITEMS = [
  { id: 'master', label: 'Início' },
  { id: 'master-players', label: 'Jogadores' },
  { id: 'master-users', label: 'Usuários' },
  { id: 'master-cities', label: 'Cidades' },
  { id: 'master-tournaments', label: 'Torneios' },
  { id: 'master-notifications', label: 'Avisos' },
  { id: 'master-reports', label: 'Relatórios' },
  { id: 'master-logs', label: 'Logs' },
];

export default function MasterNav({ current, onNavigate }) {
  return (
    <div className="tabs-row" style={{ marginBottom: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`tab ${current === item.id ? 'active' : ''}`}
          onClick={() => {
            if (item.id !== current) onNavigate?.(item.id);
          }}
          style={{ flex: '1 0 auto', minWidth: 72, whiteSpace: 'nowrap' }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
