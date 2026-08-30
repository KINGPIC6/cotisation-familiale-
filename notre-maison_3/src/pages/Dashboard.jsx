import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toSafeMessage } from '../utils/errors';
import AppShell from '../components/AppShell';
import { InlineLoading, InlineError, EmptyState } from '../components/StateViews';

function formatAmount(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [{ data: contributions, error: e1 }, { data: expenses, error: e2 }, { data: members, error: e3 }, { data: activity, error: e4 }] =
          await Promise.all([
            supabase.from('contributions').select('amount'),
            supabase.from('expenses').select('amount'),
            supabase.from('members').select('id, status').eq('status', 'active'),
            supabase
              .from('activity_logs')
              .select('id, action, details, created_at, actor:profiles(full_name)')
              .order('created_at', { ascending: false })
              .limit(8),
          ]);

        if (e1 || e2 || e3 || e4) throw e1 || e2 || e3 || e4;

        const totalContributions = (contributions || []).reduce((sum, c) => sum + Number(c.amount), 0);
        const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);

        if (mounted) {
          setState({
            loading: false,
            error: '',
            data: {
              totalContributions,
              totalExpenses,
              balance: totalContributions - totalExpenses,
              memberCount: (members || []).length,
              recentActivity: activity || [],
            },
          });
        }
      } catch (err) {
        if (mounted) setState({ loading: false, error: toSafeMessage(err), data: null });
      }
    }

    load();

    // Realtime : toute nouvelle contribution/dépense/activité recharge les totaux.
    // RLS s'applique aussi aux évènements Realtime : seuls les changements de la
    // famille de l'utilisateur connecté sont reçus.
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AppShell>
      <h1 className="page-title">Tableau de bord</h1>

      {state.loading && <InlineLoading label="Chargement du tableau de bord…" />}
      {state.error && <InlineError message={state.error} />}

      {state.data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <p className="stat-card__label">Total des contributions</p>
              <p className="stat-card__value">{formatAmount(state.data.totalContributions)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Total des dépenses</p>
              <p className="stat-card__value">{formatAmount(state.data.totalExpenses)}</p>
            </div>
            <div className="stat-card stat-card--accent">
              <p className="stat-card__label">Solde</p>
              <p className="stat-card__value">{formatAmount(state.data.balance)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-card__label">Membres actifs</p>
              <p className="stat-card__value">{state.data.memberCount}</p>
            </div>
          </div>

          <section className="section">
            <h2>Activité récente</h2>
            {state.data.recentActivity.length === 0 ? (
              <EmptyState title="Aucune activité pour l'instant" description="Les actions de la famille apparaîtront ici." />
            ) : (
              <ul className="activity-list">
                {state.data.recentActivity.map((item) => (
                  <li key={item.id} className="activity-list__item">
                    <span className="activity-list__actor">{item.actor?.full_name || 'Un membre'}</span>
                    <span className="activity-list__action">{translateAction(item.action)}</span>
                    <span className="activity-list__date">
                      {new Date(item.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function translateAction(action) {
  const map = {
    family_created: 'a créé la famille',
    contribution_added: 'a ajouté une contribution',
    expense_added: 'a ajouté une dépense',
    member_deactivated: 'a désactivé un membre',
    member_reactivated: 'a réactivé un membre',
    join_request_approved: 'a accepté une demande d\'adhésion',
    join_request_rejected: 'a refusé une demande d\'adhésion',
    role_changed: 'a modifié un rôle',
  };
  return map[action] || action;
}
