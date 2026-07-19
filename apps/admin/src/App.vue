<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { supabase } from "./supabase";

type Role = "member" | "admin" | "super_admin";
type Profile = { id: string; display_name: string; role: Role; created_at?: string };
type QueueItem = { id: string; title: string; created_at: string; author_id: string; kind: "post" | "submission" };
type Tab = "queue" | "members" | "boards" | "activities";

const roleLabels: Record<Role, string> = { member: "普通用户", admin: "管理员（审核员）", super_admin: "超级管理员" };
const email = ref("");
const notice = ref("");
const profile = ref<Profile | null>(null);
const queue = ref<QueueItem[]>([]);
const members = ref<Profile[]>([]);
const activeTab = ref<Tab>("queue");
const boardName = ref("");
const boardSlug = ref("");
const activity = ref({ title: "", slug: "", submissionStart: "", submissionEnd: "", votingStart: "", votingEnd: "", voteLimit: 1, allowVoteChange: true });
const isDark = ref(false);
const isStaff = computed(() => profile.value?.role === "admin" || profile.value?.role === "super_admin");
const isSuperAdmin = computed(() => profile.value?.role === "super_admin");
const roleLabel = (role?: Role) => role ? roleLabels[role] : "未登录";

function applyTheme(theme: "light" | "dark") { document.documentElement.dataset.theme = theme; }
function toggleTheme() { const theme = isDark.value ? "light" : "dark"; isDark.value = !isDark.value; localStorage.setItem("yh-theme", theme); applyTheme(theme); }

async function refresh() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) { profile.value = null; queue.value = []; members.value = []; return; }
  const { data: current } = await supabase.from("profiles").select("id,display_name,role,created_at").eq("id", auth.user.id).single();
  profile.value = current as Profile | null;
  if (!current || (current.role !== "admin" && current.role !== "super_admin")) return;
  const [posts, submissions] = await Promise.all([
    supabase.from("posts").select("id,title,created_at,author_id").eq("status", "pending"),
    supabase.from("activity_submissions").select("id,title,created_at,author_id").eq("status", "pending")
  ]);
  queue.value = [
    ...(posts.data ?? []).map((item) => ({ ...item, kind: "post" as const })),
    ...(submissions.data ?? []).map((item) => ({ ...item, kind: "submission" as const }))
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (current.role === "super_admin") {
    const { data } = await supabase.from("profiles").select("id,display_name,role,created_at").order("created_at", { ascending: false }).limit(100);
    members.value = (data as Profile[] | null) ?? [];
  }
}

onMounted(() => {
  const stored = localStorage.getItem("yh-theme") as "light" | "dark" | null;
  const theme = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  isDark.value = theme === "dark";
  applyTheme(theme);
  refresh();
});

async function login() {
  const { error } = await supabase.auth.signInWithOtp({ email: email.value, options: { emailRedirectTo: window.location.origin } });
  notice.value = error?.message ?? "登录链接已发送。";
}

async function signOut() { await supabase.auth.signOut(); await refresh(); }
async function moderate(item: QueueItem, status: "approved" | "rejected") {
  const table = item.kind === "post" ? "posts" : "activity_submissions";
  const { error } = await supabase.from(table).update({ status, moderated_at: new Date().toISOString(), moderated_by: profile.value?.id }).eq("id", item.id);
  notice.value = error?.message ?? `已${status === "approved" ? "通过" : "驳回"}。`;
  await refresh();
}
async function changeRole(member: Profile, event: Event) {
  const targetRole = (event.target as HTMLSelectElement).value as Role;
  const { error } = await supabase.rpc("set_member_role", { target_user: member.id, target_role: targetRole });
  notice.value = error?.message ?? `已更新 ${member.display_name} 的等级。`;
  await refresh();
}
async function createBoard() {
  const { error } = await supabase.from("boards").insert({ name: boardName.value, slug: boardSlug.value });
  notice.value = error?.message ?? "板块已创建。";
  if (!error) { boardName.value = ""; boardSlug.value = ""; }
}
async function createActivity() {
  const a = activity.value;
  const { error } = await supabase.from("activities").insert({ title: a.title, slug: a.slug, submission_starts_at: new Date(a.submissionStart).toISOString(), submission_ends_at: new Date(a.submissionEnd).toISOString(), voting_starts_at: new Date(a.votingStart).toISOString(), voting_ends_at: new Date(a.votingEnd).toISOString(), vote_limit: a.voteLimit, allow_vote_change: a.allowVoteChange, created_by: profile.value?.id });
  notice.value = error?.message ?? "活动草稿已创建。";
}
</script>

<template>
  <main>
    <header>
      <div><p class="eyebrow">Operations</p><h1>社区运营</h1></div>
      <div class="headerActions">
        <label class="themeToggle" :title="isDark ? '切换为浅色主题' : '切换为深色主题'"><input :checked="isDark" type="checkbox" aria-label="切换深色主题" @change="toggleTheme" /><span aria-hidden="true"></span></label>
        <div class="identity"><strong>{{ profile?.display_name || "未登录" }}</strong><span>{{ roleLabel(profile?.role) }}</span><button v-if="profile" class="quietButton" @click="signOut">退出</button></div>
      </div>
    </header>

    <section v-if="!profile" class="loginView"><p class="eyebrow">Member access</p><h2>登录后识别你的用户等级</h2><p>普通用户只能使用社区；管理员（审核员）可处理审核队列；超级管理员可管理用户、板块和活动。</p><div class="loginControls"><input v-model="email" type="email" placeholder="邮箱地址" /><button :disabled="!email" @click="login">发送登录链接</button></div></section>
    <section v-else-if="!isStaff" class="emptyState"><p class="eyebrow">Member</p><h2>你是普通用户</h2><p>当前账号没有运营权限。社区发帖、投稿与投票请在公开站点完成。</p></section>

    <template v-else>
      <nav>
        <button :class="{ selected: activeTab === 'queue' }" @click="activeTab = 'queue'">审核队列 <span>{{ queue.length }}</span></button>
        <button v-if="isSuperAdmin" :class="{ selected: activeTab === 'members' }" @click="activeTab = 'members'">用户等级</button>
        <button v-if="isSuperAdmin" :class="{ selected: activeTab === 'boards' }" @click="activeTab = 'boards'">板块</button>
        <button v-if="isSuperAdmin" :class="{ selected: activeTab === 'activities' }" @click="activeTab = 'activities'">活动</button>
      </nav>

      <section v-if="activeTab === 'queue'" class="workspace"><div class="sectionTitle"><h2>待审核内容</h2><p>{{ queue.length }} 项等待处理</p></div><p v-if="queue.length === 0" class="emptyLine">审核队列为空。</p><div v-else class="dataList"><article v-for="item in queue" :key="item.id"><div class="itemMain"><span>{{ item.kind === 'post' ? '主题' : '作品' }}</span><h3>{{ item.title }}</h3><p>{{ new Date(item.created_at).toLocaleString('zh-CN') }}</p></div><div class="actions"><button @click="moderate(item, 'approved')">通过</button><button class="danger" @click="moderate(item, 'rejected')">驳回</button></div></article></div></section>

      <section v-if="activeTab === 'members' && isSuperAdmin" class="workspace"><div class="sectionTitle"><h2>用户等级</h2><p>未登录、普通用户、管理员（审核员）、超级管理员</p></div><div class="memberTable"><div class="tableHead"><span>用户</span><span>加入时间</span><span>等级</span></div><div v-for="member in members" :key="member.id" class="tableRow"><strong>{{ member.display_name }}</strong><time>{{ member.created_at ? new Date(member.created_at).toLocaleDateString('zh-CN') : '-' }}</time><select :value="member.role" :disabled="member.id === profile?.id" @change="changeRole(member, $event)"><option value="member">普通用户</option><option value="admin">管理员（审核员）</option><option value="super_admin">超级管理员</option></select></div></div></section>

      <section v-if="activeTab === 'boards' && isSuperAdmin" class="workspace"><div class="sectionTitle"><h2>新建板块</h2><p>板块会立即出现在公开社区。</p></div><form @submit.prevent="createBoard"><label>名称<input v-model="boardName" required /></label><label>Slug<input v-model="boardSlug" pattern="[a-z0-9-]{2,60}" required /></label><button>创建板块</button></form></section>

      <section v-if="activeTab === 'activities' && isSuperAdmin" class="workspace"><div class="sectionTitle"><h2>创建活动草稿</h2><p>设置完时间与票数后，再通过 Supabase 将草稿发布。</p></div><form @submit.prevent="createActivity"><label>活动名称<input v-model="activity.title" required /></label><label>Slug<input v-model="activity.slug" pattern="[a-z0-9-]{2,60}" required /></label><label>投稿开始<input v-model="activity.submissionStart" type="datetime-local" required /></label><label>投稿结束<input v-model="activity.submissionEnd" type="datetime-local" required /></label><label>投票开始<input v-model="activity.votingStart" type="datetime-local" required /></label><label>投票结束<input v-model="activity.votingEnd" type="datetime-local" required /></label><label>每人票数<input v-model.number="activity.voteLimit" type="number" min="1" max="100" required /></label><label class="check"><input v-model="activity.allowVoteChange" type="checkbox" /> 允许用户修改投票</label><button>创建草稿</button></form></section>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </template>
  </main>
</template>
