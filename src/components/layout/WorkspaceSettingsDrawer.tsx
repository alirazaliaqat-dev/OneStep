import React, { useState } from 'react';
import { Copy, Check, ExternalLink, RefreshCw, Unlink, Smartphone, ShieldCheck } from 'lucide-react';
import type { MetaStatusResponse, RolePermissions, RoleRecord, TikTokStatusResponse } from '../../types/crm';
import { SlideDrawer, GlassButton } from '../ui/LiquidGlass';
import { getHapticsEnabled, setHapticsEnabled, triggerHaptic } from '../../utils/haptics';
import { formatRelativeTime } from '../../utils/formatters';

interface WorkspaceSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  metaStatus: MetaStatusResponse | null;
  tiktokStatus: TikTokStatusResponse | null;
  roles: RoleRecord[];
  activeRoleId: string;
  permissions: RolePermissions;
  onChangeActiveRole: (roleId: string) => void;
  onConnectMeta: () => void;
  onSyncMeta: () => Promise<void>;
  onDisconnectMeta: () => Promise<void>;
  onConnectTikTok: () => void;
  onSyncTikTok: () => Promise<void>;
  onDisconnectTikTok: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function WorkspaceSettingsDrawer({
  open,
  onClose,
  metaStatus,
  tiktokStatus,
  roles,
  activeRoleId,
  permissions,
  onChangeActiveRole,
  onConnectMeta,
  onSyncMeta,
  onDisconnectMeta,
  onConnectTikTok,
  onSyncTikTok,
  onDisconnectTikTok,
  onNotify,
}: WorkspaceSettingsDrawerProps) {
  const [hapticsOn, setHapticsOn] = useState<boolean>(getHapticsEnabled());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isMetaConnected = metaStatus?.connection?.status === 'Connected';
  const isTikTokConnected = tiktokStatus?.connection?.status === 'Connected';
  const canManageIntegrations =
    permissions.modifications.manageCampaigns || permissions.modifications.manageTeam;

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      triggerHaptic('success');
      setCopiedField(label);
      onNotify(`${label} copied to clipboard.`);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      triggerHaptic('warning');
      onNotify(`Copy ${label} manually from the field.`);
    }
  };

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      title="Workspace Setup"
      subtitle="Meta & TikTok Channels, Active Role & Tactile Preferences"
    >
      <div className="space-y-6 text-black">
        {/* Active Role Access Switcher */}
        <section className="glass-panel-subtle rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-[#08131F]/8 border border-white/75 text-[#16314A] inline-flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14.5px] font-semibold text-[#08131F]">Active Access Role</h3>
              <p className="text-[12.5px] text-[#08131F]/65 mt-0.5">
                Preview sidebar navigation, inbox scope & reporting visibility per role.
              </p>
            </div>
          </div>
          <select
            aria-label="Select active role view"
            value={activeRoleId}
            onChange={(e) => {
              triggerHaptic('selection');
              onChangeActiveRole(e.target.value);
            }}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-white/55 border border-white/80 text-[13.5px] font-medium text-[#08131F] focus:outline-none focus:border-[#2E4F6B]"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </section>

        {/* Meta Business OAuth Connection (Admin & Manager Only) */}
        {canManageIntegrations && (
          <>
            <section className="glass-panel-subtle rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-black">Meta Business Integration</h3>
                  <p className="text-[12.5px] text-black/65 mt-1">
                    {isMetaConnected
                      ? `Connected · ${metaStatus?.connection?.businessName}`
                      : 'Facebook, Instagram & Messenger · Graph API v21.0'}
                  </p>
                </div>
                <span className={`text-[12px] font-semibold whitespace-nowrap ${isMetaConnected ? 'text-[#2E4F6B]' : 'text-[#08131F]/65'}`}>
                  {isMetaConnected ? 'Live Sync' : 'Ready to Link'}
                </span>
              </div>

              {isMetaConnected && metaStatus?.connection ? (
                <div className="space-y-2 text-[13px] text-[#08131F] pt-2 border-t border-[#08131F]/10">
                  <div className="flex justify-between gap-2">
                    <span className="text-black/60">Ad Account</span>
                    <span className="font-medium tabular-nums">{metaStatus.connection.adAccountId}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-black/60">Facebook Page</span>
                    <span className="font-medium">{metaStatus.connection.pageName}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-black/60">Instagram</span>
                    <span className="font-medium">{metaStatus.connection.instagramHandle}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-black/60">Last Synced</span>
                    <span className="font-medium tabular-nums">
                      {metaStatus.connection.lastSyncedAt
                        ? formatRelativeTime(metaStatus.connection.lastSyncedAt)
                        : 'Pending'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-black/75 leading-relaxed">
                  Connect Meta Business Manager to pull live Facebook Lead Ads, Instagram DMs, Messenger inquiries, and ad creative attribution.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {isMetaConnected ? (
                  <>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onSyncMeta();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                      <span>Sync Meta</span>
                    </GlassButton>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onDisconnectMeta();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </GlassButton>
                  </>
                ) : (
                  <GlassButton variant="primary" size="sm" onClick={onConnectMeta}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Connect Meta</span>
                  </GlassButton>
                )}
              </div>
            </section>

            {/* TikTok Business & Messages Integration */}
            <section className="glass-panel-subtle rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-black">TikTok Business & Messages</h3>
                  <p className="text-[12.5px] text-black/65 mt-1">
                    {isTikTokConnected
                      ? `Connected · ${tiktokStatus?.connection?.tiktokHandle}`
                      : 'TikTok Direct Messages & Spark Lead Forms'}
                  </p>
                </div>
                <span className={`text-[12px] font-semibold whitespace-nowrap ${isTikTokConnected ? 'text-[#2E4F6B]' : 'text-[#08131F]/65'}`}>
                  {isTikTokConnected ? 'Live Sync' : 'Ready to Link'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {isTikTokConnected ? (
                  <>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onSyncTikTok();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                      <span>Sync TikTok</span>
                    </GlassButton>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onDisconnectTikTok();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </GlassButton>
                  </>
                ) : (
                  <GlassButton variant="primary" size="sm" onClick={onConnectTikTok}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Connect TikTok</span>
                  </GlassButton>
                )}
              </div>
            </section>

            {/* Callback & Webhook Endpoints */}
            <section className="glass-panel-subtle rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-[15px] font-semibold text-black">Developer App Endpoints</h3>
                <p className="text-[12.5px] text-black/65 mt-1">
                  Configure these exact OAuth callbacks and webhooks in Meta & TikTok Developer portals.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Meta OAuth Redirect URI',
                    value: metaStatus?.redirectUri || '/auth/meta/callback',
                  },
                  {
                    label: 'Meta Webhook URL',
                    value: metaStatus?.webhookUrl || '/api/meta/webhook',
                  },
                  {
                    label: 'TikTok OAuth Redirect URI',
                    value: tiktokStatus?.redirectUri || '/auth/tiktok/callback',
                  },
                  {
                    label: 'TikTok Messages Webhook URL',
                    value: tiktokStatus?.webhookUrl || '/api/tiktok/webhook',
                  },
                ].map((endpoint) => (
                  <div key={endpoint.label}>
                    <div className="flex items-center justify-between text-[12px] font-medium text-black/70 mb-1">
                      <span>{endpoint.label}</span>
                      <button
                        type="button"
                        onClick={() => copyValue(endpoint.label, endpoint.value)}
                        className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-black hover:underline font-semibold cursor-pointer"
                      >
                        {copiedField === endpoint.label ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedField === endpoint.label ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="px-3 py-2 rounded-xl bg-white/55 border border-white/80 text-[12px] text-[#08131F] break-all select-all">
                      {endpoint.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Tactile Haptics */}
        <section className="glass-panel-subtle rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-[#08131F]/8 border border-white/75 text-[#16314A] inline-flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-[14.5px] font-semibold text-black">Touch Haptic Feedback</h3>
                <p className="text-[12.5px] text-black/65 mt-0.5">
                  Tactile vibration pulses on supported touch devices.
                </p>
              </div>
            </div>
            <GlassButton
              variant={hapticsOn ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={hapticsOn}
              onClick={() => {
                const next = !hapticsOn;
                setHapticsEnabled(next);
                setHapticsOn(next);
                if (next) triggerHaptic('success');
                onNotify(next ? 'Touch haptics enabled.' : 'Touch haptics muted.');
              }}
            >
              <span>{hapticsOn ? 'Enabled' : 'Muted'}</span>
            </GlassButton>
          </div>
        </section>
      </div>
    </SlideDrawer>
  );
}
