<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { supabase } from "./supabase";

type Profile = { id: string; display_name: string; role: "member" | "reviewer" | "admin" };
type QueueItem = { id: string; title: string; created_at: string; author_id: string; kind: "post" | "submission" };
const email = ref(""); const notice = ref(""); const profile = ref<Profile | null>(null); const queue = ref<QueueItem[]>([]); const activeTab = ref<"queue" | "boards" | "activities">("queue");
const boardName = ref(""); const boardSlug = ref(""); const activity = ref({ title: "", slug: "", submissionStart: "", submissionEnd: "", votingStart: "", votingEnd: "", voteLimit: 1, allowVoteChange: true });
const isStaff = computed(() => profile.value?.role === "admin" || profile.value?.role === "reviewer"); const isAdmin = computed(() => profile.value?.role === "admin");

async function refresh() { const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return; const { data: current } = await supabase.from("profiles").select("id,display_name,role").eq("id", auth.user.id).single(); profile.value = current as Profile | null; if (current?.role === "admin" || current?.role === "reviewer") { const [posts, submissions] = await Promise.all([supabase.from("posts").select("id,title,created_at,author_id").eq("status", "pending"), supabase.from("activity_submissions").select("id,title,created_at,author_id").eq("status", "pending")]); queue.value = [...(posts.data ?? []).map((item) => ({ ...item, kind: "post" as const })), ...(submissions.data ?? []).map((item) => ({ ...item, kind: "submission" as const }))].sort((a, b) => b.created_at.localeCompare(a.created_at)); } }
onMounted(refresh);
async function login() { const { error } = await supabase.auth.signInWithOtp({ email: email.value, options: { emailRedirectTo: window.location.origin } }); notice.value = error?.message ?? "登录链接已发送。"; }
async function moderate(item: QueueItem, status: "approved" | "rejected") { const table = item.kind === "post" ? "posts" : "activity_submissions"; const { error } = await supabase.from(table).update({ status, moderated_at: new Date().toISOString(), moderated_by: profile.value?.id }).eq("id", item.id); notice.value = error?.message ?? `已${status === "approved" ? "通过" : "驳回"}。`; await refresh(); }
async function createBoard() { const { error } = await supabase.from("boards").insert({ name: boardName.value, slug: boardSlug.value }); notice.value = error?.message ?? "板块已创建。"; if (!error) { boardName.value = ""; boardSlug.value = ""; } }
async function createActivity() { const a = activity.value; const { error } = await supabase.from("activities").insert({ title: a.title, slug: a.slug, submission_starts_at: new Date(a.submissionStart).toISOString(), submission_ends_at: new Date(a.submissionEnd).toISOString(), voting_starts_at: new Date(a.votingStart).toISOString(), voting_ends_at: new Date(a.votingEnd).toISOString(), vote_limit: a.voteLimit, allow_vote_change: a.allowVoteChange, created_by: profile.value?.id }); notice.value = error?.message ?? "活动草稿已创建。"; }
</script>

<template>
  <main><header><div><p class="eyebrow">Operations</p><h1>YH Community 后台</h1></div><div v-if="profile" class="profile"><strong>{{ profile.display_name }}</strong><span>{{ profile.role }}</span><button @click="supabase.auth.signOut().then(() => { profile = null; queue = [] })">退出</button></div></header>
    <section v-if="!profile" class="login"><h2>后台登录</h2><p>仅管理员和审核员可访问运营功能。</p><input v-model="email" type="email" placeholder="邮箱地址" /><button :disabled="!email" @click="login">发送登录链接</button><p v-if="notice">{{ notice }}</p></section>
    <section v-else-if="!isStaff" class="login"><h2>没有后台权限</h2><p>当前账户是普通成员。请由管理员在 Supabase 控制台或受控 SQL 中授予审核员/管理员角色。</p></section>
    <template v-else><nav><button :class="{ selected: activeTab === 'queue' }" @click="activeTab = 'queue'">审核队列 ({{ queue.length }})</button><button v-if="isAdmin" :class="{ selected: activeTab === 'boards' }" @click="activeTab = 'boards'">板块</button><button v-if="isAdmin" :class="{ selected: activeTab === 'activities' }" @click="activeTab = 'activities'">活动</button></nav>
      <section v-if="activeTab === 'queue'" class="panel"><h2>待审核内容</h2><p v-if="queue.length === 0">审核队列为空。</p><article v-for="item in queue" :key="item.id"><div><span>{{ item.kind === 'post' ? '主题' : '作品' }}</span><h3>{{ item.title }}</h3><p>{{ new Date(item.created_at).toLocaleString('zh-CN') }}</p></div><div class="actions"><button @click="moderate(item, 'approved')">通过</button><button class="danger" @click="moderate(item, 'rejected')">驳回</button></div></article></section>
      <section v-if="activeTab === 'boards' && isAdmin" class="panel"><h2>创建板块</h2><form @submit.prevent="createBoard"><label>名称<input v-model="boardName" required /></label><label>Slug<input v-model="boardSlug" pattern="[a-z0-9-]{2,60}" required /></label><button>创建板块</button></form></section>
      <section v-if="activeTab === 'activities' && isAdmin" class="panel"><h2>创建活动草稿</h2><form @submit.prevent="createActivity"><label>活动名称<input v-model="activity.title" required /></label><label>Slug<input v-model="activity.slug" pattern="[a-z0-9-]{2,60}" required /></label><label>投稿开始<input v-model="activity.submissionStart" type="datetime-local" required /></label><label>投稿结束<input v-model="activity.submissionEnd" type="datetime-local" required /></label><label>投票开始<input v-model="activity.votingStart" type="datetime-local" required /></label><label>投票结束<input v-model="activity.votingEnd" type="datetime-local" required /></label><label>每人票数<input v-model.number="activity.voteLimit" type="number" min="1" max="100" required /></label><label class="check"><input v-model="activity.allowVoteChange" type="checkbox" /> 允许用户修改投票</label><button>创建草稿</button></form></section>
      <p v-if="notice" class="notice">{{ notice }}</p>
    </template>
  </main>
</template>
