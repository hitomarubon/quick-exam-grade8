import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookPlus,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Cloud,
  CloudOff,
  Copy,
  Flame,
  Lock,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import {
  ALL_SUBJECTS,
  AppSettings,
  DailyMissionPlan,
  DailyStatus,
  FirebaseConfigData,
  KanjiItem,
  Question,
  StudyLog,
  StudyProgress,
  Subject,
  SyncConnectionState,
  Unit,
  VocabWord,
  WeekdayKey,
} from '../types/quiz';
import { getLocalDateKey } from '../hooks/useStudyHub';
import {
  isValidFamilyId,
  parseFirebaseConfigText,
  testFirebaseConnection,
} from '../services/firebaseService';
import { CameraImportPanel } from './CameraImportPanel';

interface ParentDashboardViewProps {
  settings: AppSettings;
  allUnits: Unit[];
  allQuestions: Question[];
  progress: StudyProgress;
  studyLogs: StudyLog[];
  dailyStatusMap: Record<string, DailyStatus>;
  todayStatus: DailyStatus;
  streakDays: number;
  dailyMissionPlan: DailyMissionPlan;
  familyId: string;
  firebaseConfig: FirebaseConfigData | null;
  syncState: SyncConnectionState;
  syncError: string;
  pendingSyncCount: number;
  onUpdateSettings: (next: AppSettings) => Promise<void>;
  onAddUnits: (units: Unit[]) => Promise<void>;
  onDeleteCustomUnit: (unitId: string) => Promise<void>;
  onAddQuestions: (questions: Question[]) => Promise<void>;
  onAddKanji: (items: KanjiItem[]) => Promise<void>;
  onAddVocab: (words: VocabWord[]) => Promise<void>;
  onConfigureFirebase: (config: FirebaseConfigData | null, familyId: string) => Promise<void>;
  onManualSync: () => Promise<number>;
  onBackHome: () => void;
}

type ParentTab = 'stats' | 'schedule' | 'camera' | 'firebase';

const WEEKDAY_ITEMS: Array<{ key: WeekdayKey; label: string }> = [
  { key: 'mon', label: '月' },
  { key: 'tue', label: '火' },
  { key: 'wed', label: '水' },
  { key: 'thu', label: '木' },
  { key: 'fri', label: '金' },
  { key: 'sat', label: '土' },
];

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}分${s}秒` : `${m}分`;
}

export const ParentDashboardView: React.FC<ParentDashboardViewProps> = ({
  settings,
  allUnits,
  allQuestions,
  progress,
  studyLogs,
  dailyStatusMap,
  todayStatus,
  streakDays,
  dailyMissionPlan,
  familyId,
  firebaseConfig,
  syncState,
  syncError,
  pendingSyncCount,
  onUpdateSettings,
  onAddUnits,
  onDeleteCustomUnit,
  onAddQuestions,
  onAddKanji,
  onAddVocab,
  onConfigureFirebase,
  onManualSync,
  onBackHome,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<ParentTab>('stats');

  // Local editable draft for schedule/settings
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState('');

  // Firebase config form state
  const [familyIdInput, setFamilyIdInput] = useState(familyId);
  const [firebaseJsonInput, setFirebaseJsonInput] = useState(() =>
    firebaseConfig ? JSON.stringify(firebaseConfig, null, 2) : ''
  );
  const [firebaseStatusMsg, setFirebaseStatusMsg] = useState('');
  const [firebaseTesting, setFirebaseTesting] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState('');

  const last14Days = useMemo(() => {
    const days: Array<{ dateKey: string; label: string; count: number; status?: DailyStatus }> = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime());
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const st = dailyStatusMap[key];
      const count = st
        ? [st.reviewDone, st.previewDone, st.kanjiDone, st.vocabDone].filter(Boolean).length
        : 0;
      days.push({
        dateKey: key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        count,
        status: st,
      });
    }
    return days;
  }, [dailyStatusMap]);

  const subjectStats = useMemo(() => {
    return ALL_SUBJECTS.map((subj) => {
      const pool = allQuestions.filter((q) => q.subject === subj);
      let attempts = 0;
      let correct = 0;
      for (const q of pool) {
        const rec = progress.records[q.id];
        if (rec) {
          attempts += rec.attempts;
          correct += rec.correct;
        }
      }
      return {
        subject: subj,
        totalQuestions: pool.length,
        attempts,
        rate: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
      };
    });
  }, [allQuestions, progress.records]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === (settings.parentPin || '0000')) {
      setUnlocked(true);
      setPinError('');
      setDraftSettings(settings);
    } else {
      setPinError('暗証番号が違います（初期値は 0000 です）');
    }
  };

  const handleToggleTimetableSubject = (day: WeekdayKey, subj: Subject) => {
    setDraftSettings((prev) => {
      const current = prev.timetable[day] || [];
      const exists = current.includes(subj);
      const nextList = exists ? current.filter((s) => s !== subj) : [...current, subj];
      return {
        ...prev,
        timetable: {
          ...prev.timetable,
          [day]: nextList,
        },
      };
    });
  };

  const handleSaveSchedule = async () => {
    await onUpdateSettings(draftSettings);
    setScheduleSavedMsg('時間割と現在の単元を保存・同期しました！');
    window.setTimeout(() => setScheduleSavedMsg(''), 3500);
  };

  const handleTestAndSaveFirebase = async () => {
    setFirebaseStatusMsg('');
    if (!isValidFamilyId(familyIdInput)) {
      setFirebaseStatusMsg('家族IDは8〜64文字の半角英数字・ハイフン・アンダースコアにしてください。');
      return;
    }

    let parsedConfig: FirebaseConfigData;
    try {
      parsedConfig = parseFirebaseConfigText(firebaseJsonInput);
    } catch (err) {
      setFirebaseStatusMsg(err instanceof Error ? err.message : 'Firebase設定の形式を確認してください。');
      return;
    }

    setFirebaseTesting(true);
    const result = await testFirebaseConnection(parsedConfig, familyIdInput.trim());
    setFirebaseTesting(false);
    setFirebaseStatusMsg(result.message);

    if (result.ok) {
      await onConfigureFirebase(parsedConfig, familyIdInput.trim());
      await onUpdateSettings(draftSettings);
    }
  };

  const handleCopyUrl = async (mode: 'child' | 'parent') => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const url =
      mode === 'parent'
        ? `${base}?mode=parent&family=${encodeURIComponent(familyId)}`
        : `${base}?family=${encodeURIComponent(familyId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedMsg(mode === 'parent' ? '保護者用URLをコピーしました' : 'お子様用URLをコピーしました');
      window.setTimeout(() => setCopiedMsg(''), 3000);
    } catch {
      setCopiedMsg(url);
    }
  };

  if (!unlocked) {
    return (
      <div className="space-y-4 pb-10">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70"
        >
          <ChevronLeft className="h-4 w-4" />
          ホームへ戻る
        </button>

        <form
          onSubmit={handleUnlock}
          className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm space-y-4"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">保護者・管理モード</h2>
            <p className="mt-1 text-xs text-slate-500">
              暗証番号（4桁PIN）を入力してください。初期設定は <strong>0000</strong> です。
            </p>
          </div>

          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="PINを入力 (初期: 0000)"
            className="mx-auto block w-48 rounded-2xl border-2 border-slate-200 px-4 py-3 text-center text-lg font-black tracking-widest focus:border-indigo-500 focus:outline-none"
          />

          {pinError && <p className="text-xs font-bold text-rose-600">{pinError}</p>}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md active:scale-95"
          >
            <Unlock className="h-4 w-4" />
            管理画面を開く
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70"
        >
          <ChevronLeft className="h-4 w-4" />
          子ども画面へ
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              syncState === 'connected'
                ? 'bg-emerald-100 text-emerald-700'
                : syncState === 'unconfigured'
                ? 'bg-slate-200 text-slate-700'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {syncState === 'connected' ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <CloudOff className="h-3.5 w-3.5" />
            )}
            {syncState === 'connected'
              ? 'クラウド同期中'
              : syncState === 'unconfigured'
              ? 'ローカル動作中'
              : syncState === 'offline'
              ? 'オフライン'
              : '接続確認中'}
          </span>

          {firebaseConfig && (
            <button
              type="button"
              onClick={() => onManualSync()}
              className="rounded-xl bg-white border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
              title="手動で同期"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-200/70 p-1">
        {(
          [
            { id: 'stats', label: '実績', icon: BarChart3 },
            { id: 'schedule', label: '時間割', icon: Calendar },
            { id: 'camera', label: '問題追加', icon: BookPlus },
            { id: 'firebase', label: '設定', icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'schedule' || tab.id === 'firebase') {
                  setDraftSettings(settings);
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[11px] font-extrabold transition ${
                active
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: STATS */}
      {activeTab === 'stats' && (
        <div className="space-y-4">
          {pendingSyncCount > 0 && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-800">
              <span>未送信の学習データ: {pendingSyncCount} 件</span>
              <button
                type="button"
                onClick={() => onManualSync()}
                className="rounded-lg bg-amber-600 px-2.5 py-1 text-white"
              >
                今すぐ送信
              </button>
            </div>
          )}

          {/* Today Summary */}
          <section className="rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-300">
                  {settings.studentName} の今日の実績（{todayStatus.dateKey}）
                </p>
                <h3 className="text-xl font-black mt-0.5">
                  {[
                    todayStatus.reviewDone,
                    todayStatus.previewDone,
                    todayStatus.kanjiDone,
                    todayStatus.vocabDone,
                  ].filter(Boolean).length}{' '}
                  / 4 ミッション完了
                </h3>
              </div>
              <div className="flex items-center gap-1 rounded-2xl bg-amber-500/20 px-3 py-1.5 text-amber-300 border border-amber-400/30">
                <Flame className="h-4 w-4" />
                <span className="text-sm font-black">{streakDays}日連続</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { label: '今日の復習', done: todayStatus.reviewDone },
                  { label: '明日の予習', done: todayStatus.previewDone },
                  { label: '手書き漢字', done: todayStatus.kanjiDone },
                  { label: '英単語3秒', done: todayStatus.vocabDone },
                ] as const
              ).map((m) => (
                <div
                  key={m.label}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
                    m.done
                      ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  <span className="font-bold">{m.label}</span>
                  <span>{m.done ? '✅ 完了' : '⏳ 未'}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs text-slate-300 pt-1 border-t border-white/10">
              <span>
                本日の解答: {todayStatus.totalCorrect} / {todayStatus.totalAnswered} 問正解
              </span>
              <span>学習時間: {formatDuration(todayStatus.totalDurationSec)}</span>
            </div>
          </section>

          {/* 14-day Calendar */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-xs font-extrabold text-slate-800 mb-3">
              直近14日間の取り組み状況（色が濃いほど多くのミッションを達成）
            </h4>
            <div className="grid grid-cols-7 gap-1.5">
              {last14Days.map((day) => {
                const bg =
                  day.count === 0
                    ? 'bg-slate-100 text-slate-400'
                    : day.count === 1
                    ? 'bg-emerald-100 text-emerald-800'
                    : day.count === 2
                    ? 'bg-emerald-300 text-emerald-950'
                    : day.count === 3
                    ? 'bg-emerald-500 text-white'
                    : 'bg-indigo-600 text-white';
                return (
                  <div
                    key={day.dateKey}
                    className={`flex flex-col items-center justify-center rounded-xl py-2 ${bg}`}
                  >
                    <span className="text-[10px] font-bold">{day.label}</span>
                    <span className="text-xs font-black mt-0.5">{day.count}/4</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Subject Accuracy */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
            <h4 className="text-xs font-extrabold text-slate-800">教科別の問題数と正答率</h4>
            <div className="grid grid-cols-3 gap-2">
              {subjectStats.map((st) => (
                <div
                  key={st.subject}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center"
                >
                  <p className="text-xs font-extrabold text-slate-800">{st.subject}</p>
                  <p className="text-base font-black text-indigo-600 mt-0.5">
                    {st.rate !== null ? `${st.rate}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400">全{st.totalQuestions}問</p>
                </div>
              ))}
            </div>
          </section>

          {/* Timeline */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
            <h4 className="text-xs font-extrabold text-slate-800">
              全アプリ統合 学習ログ（最新20件）
            </h4>
            {studyLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                まだ学習履歴がありません。ミッションを1つ完了するとここに記録されます。
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {studyLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          {log.appId === 'kanji'
                            ? '漢字'
                            : log.appId === 'vocab'
                            ? '英単語'
                            : log.subject}
                        </span>
                        <span className="font-bold text-slate-800 truncate">
                          {log.unitTitle}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(log.completedAt).toLocaleString('ja-JP')} ・ 所要{' '}
                        {formatDuration(log.durationSec)}
                      </p>
                    </div>
                    <span className="shrink-0 font-black text-indigo-600">
                      {log.score}/{log.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: SCHEDULE & PROGRESS */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900">学校の時間割（曜日別）</h4>
              <span className="text-[11px] text-slate-500">予習・復習の対象教科に連動</span>
            </div>

            <div className="space-y-2.5">
              {WEEKDAY_ITEMS.map((day) => {
                const selected = draftSettings.timetable[day.key] || [];
                return (
                  <div
                    key={day.key}
                    className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"
                  >
                    <span className="w-7 text-center text-xs font-black text-slate-700">
                      {day.label}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_SUBJECTS.map((subj) => {
                        const active = selected.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => handleToggleTimetableSubject(day.key, subj)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition ${
                              active
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-200 bg-white text-slate-500'
                            }`}
                          >
                            {subj}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                いま学校で習っている単元（現在地）
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                選んだ単元が「今日の復習」、その次の単元が「明日の予習」になります。
              </p>
            </div>

            <div className="space-y-2.5">
              {ALL_SUBJECTS.map((subj) => {
                const subjUnits = allUnits.filter((u) => u.subject === subj);
                return (
                  <div key={subj} className="space-y-1">
                    <label className="text-xs font-extrabold text-slate-700">{subj}</label>
                    <select
                      value={draftSettings.currentUnitBySubject[subj] || ''}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          currentUnitBySubject: {
                            ...prev.currentUnitBySubject,
                            [subj]: e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                    >
                      {subjUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.order}. {u.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Daily Target Counts */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900">1日の目標出題数</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-600">今日の復習（問）</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draftSettings.dailyTargets.reviewCount}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      dailyTargets: {
                        ...prev.dailyTargets,
                        reviewCount: Math.max(1, Number(e.target.value) || 5),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600">明日の予習（問）</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draftSettings.dailyTargets.previewCount}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      dailyTargets: {
                        ...prev.dailyTargets,
                        previewCount: Math.max(1, Number(e.target.value) || 5),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600">手書き漢字（問）</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draftSettings.dailyTargets.kanjiCount}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      dailyTargets: {
                        ...prev.dailyTargets,
                        kanjiCount: Math.max(1, Number(e.target.value) || 5),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600">英単語（語）</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draftSettings.dailyTargets.vocabCount}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      dailyTargets: {
                        ...prev.dailyTargets,
                        vocabCount: Math.max(1, Number(e.target.value) || 10),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs space-y-1">
            <p className="font-extrabold text-indigo-900">現在の自動選定プレビュー</p>
            <p className="text-indigo-800">
              ・復習（{dailyMissionPlan.todayWeekdayLabel}）:{' '}
              {dailyMissionPlan.reviewUnits.map((u) => u.title).join(' / ')}
            </p>
            <p className="text-indigo-800">
              ・予習（{dailyMissionPlan.tomorrowWeekdayLabel}）:{' '}
              {dailyMissionPlan.previewUnits.map((u) => u.title).join(' / ')}
            </p>
          </div>

          {scheduleSavedMsg && (
            <div className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {scheduleSavedMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveSchedule}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-sm font-extrabold text-white shadow-md active:scale-95"
          >
            <Save className="h-4 w-4" />
            時間割・進度を保存して同期
          </button>
        </div>
      )}

      {/* TAB 3: CAMERA IMPORT */}
      {activeTab === 'camera' && (
        <CameraImportPanel
          allUnits={allUnits}
          onAddUnits={onAddUnits}
          onDeleteCustomUnit={onDeleteCustomUnit}
          onAddQuestions={onAddQuestions}
          onAddKanji={onAddKanji}
          onAddVocab={onAddVocab}
        />
      )}

      {/* TAB 4: FIREBASE & GENERAL SETTINGS */}
      {activeTab === 'firebase' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h4 className="text-sm font-extrabold text-slate-900">
                Firebase クラウド同期設定
              </h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              同じ家族IDとFirebase設定を「お子様のスマホ」と「保護者のスマホ」に入力すると、実績やカメラ追加した単元がリアルタイムに同期されます（手順は <code>FIREBASE_SETUP.md</code> を参照）。
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                家族ID（8文字以上の半角英数字・-・_）
              </label>
              <input
                type="text"
                value={familyIdInput}
                onChange={(e) => setFamilyIdInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                firebaseConfig（Firebaseコンソールからそのまま貼り付けOK）
              </label>
              <textarea
                rows={7}
                value={firebaseJsonInput}
                onChange={(e) => setFirebaseJsonInput(e.target.value)}
                placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  "appId": "..."\n}'}
                className="w-full rounded-xl border border-slate-300 p-3 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {(firebaseStatusMsg || syncError) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700">
                {firebaseStatusMsg || syncError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={firebaseTesting}
                onClick={handleTestAndSaveFirebase}
                className="rounded-xl bg-indigo-600 py-3 text-xs font-extrabold text-white shadow-sm disabled:opacity-60"
              >
                {firebaseTesting ? '接続テスト中...' : '接続テストして保存'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onConfigureFirebase(null, familyIdInput);
                  setFirebaseJsonInput('');
                  setFirebaseStatusMsg('Firebase設定をクリアし、ローカルモードに切り替えました。');
                }}
                className="rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700"
              >
                設定をクリア
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-xs font-extrabold text-slate-700">共有用リンク</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyUrl('child')}
                  className="flex items-center justify-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 py-2 text-[11px] font-bold text-indigo-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  子ども用URLコピー
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyUrl('parent')}
                  className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-[11px] font-bold text-slate-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  保護者URLコピー
                </button>
              </div>
              {copiedMsg && (
                <p className="text-[11px] font-bold text-emerald-700">{copiedMsg}</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900">お子様の名前・PIN設定</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-600">表示名</label>
                <input
                  type="text"
                  value={draftSettings.studentName}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({ ...prev, studentName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600">保護者PIN</label>
                <input
                  type="text"
                  maxLength={8}
                  value={draftSettings.parentPin}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({ ...prev, parentPin: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono font-bold"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveSchedule}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-xs font-extrabold text-white"
            >
              <Save className="h-4 w-4" />
              名前・PINを保存
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
