import type {
  AgentCareEventsResponse,
  AgentCarePlanResponse,
  AgentConversationMessagesResponse,
  AgentConversationResponse,
  AddAgentGroupChatMembersRequest,
  AddAgentGroupChatMembersResponse,
  AvatarUploadResponse,
  CreateMyAgentCompanionRequest,
  CreateMyAgentCompanionResponse,
  CreateAgentGroupChatRequest,
  CreateAgentGroupChatResponse,
  GenerateAgentCareEventRequest,
  GenerateAgentCareEventResponse,
  AgentGroupChatDetailResponse,
  AgentGroupChatListResponse,
  AgentGroupChatMessagesResponse,
  MyAgentMemoriesResponse,
  MyAgentCompanionDetailResponse,
  MyAgentInboxResponse,
  SendAgentGroupChatMessageRequest,
  SendAgentGroupChatMessageResponse,
  UpdateAgentMemoryRequest,
  UpdateAgentMemoryResponse,
  UpsertAgentCarePlanRequest,
  UpdateMyAgentCompanionRequest,
  UpdateMyAgentCompanionResponse,
  UploadMyAgentCompanionImageResponse,
  UserProfileResponse,
  MyAgentSummaryResponse,
  LlmTestConnectionRequest,
  LlmTestConnectionResponse,
  SubmitAgentMessageFeedbackRequest,
  SubmitAgentMessageFeedbackResponse,
  WebGithubAuthUrlResponse,
  WebGithubTicketLoginRequest,
  WebGithubTicketLoginResponse,
  WebLogoutRequest,
  WebPasswordLoginRequest,
  WebPasswordLoginResponse,
  WebTokenRefreshRequest,
  WebTokenRefreshResponse,
} from '@repo/contracts'
import { http } from '@/lib/http'

export function loginWithWebPassword(input: WebPasswordLoginRequest) {
  return http.post<WebPasswordLoginResponse, WebPasswordLoginRequest>('/auth/web/password/login', input)
}

export function getWebGithubAuthUrl() {
  return http.get<WebGithubAuthUrlResponse>('/auth/web/github/authorize')
}

export function loginWithWebGithubTicket(input: WebGithubTicketLoginRequest) {
  return http.post<WebGithubTicketLoginResponse, WebGithubTicketLoginRequest>('/auth/web/github/ticket/login', input)
}

export function refreshWebSession(input: WebTokenRefreshRequest) {
  return http.post<WebTokenRefreshResponse, WebTokenRefreshRequest>('/auth/web/token/refresh', input)
}

export function logoutWebSession(input: WebLogoutRequest) {
  return http.post<{ success: true }, WebLogoutRequest>('/auth/web/logout', input)
}

export function getWebUserProfile(accessToken?: string) {
  return http.get<UserProfileResponse>('/rpc/user/profile', accessToken ? {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  } : undefined)
}

export function uploadWebUserAvatar(file: File) {
  const formData = new FormData()
  formData.set('file', file)

  return http.post<AvatarUploadResponse, FormData>('/rpc/user/profile/avatar', formData)
}

export function getMyAgentSummary() {
  return http.get<MyAgentSummaryResponse>('/rpc/agent/my/summary')
}

export function testLlmConnection(input: LlmTestConnectionRequest) {
  return http.post<LlmTestConnectionResponse, LlmTestConnectionRequest>('/rpc/llm/test-connection', input)
}

export function getMyAgentInbox() {
  return http.get<MyAgentInboxResponse>('/rpc/agent/my/inbox')
}

export function getAgentConversation(agentId: string) {
  return http.get<AgentConversationResponse>(`/rpc/chat/inbox/${agentId}/conversation`)
}

export function getAgentConversationMessages(agentId: string, cursor: string) {
  return http.get<AgentConversationMessagesResponse>(`/rpc/chat/inbox/${agentId}/messages?cursor=${encodeURIComponent(cursor)}`)
}

export function submitAgentMessageFeedback(
  agentId: string,
  messageId: string,
  input: SubmitAgentMessageFeedbackRequest,
) {
  return http.post<SubmitAgentMessageFeedbackResponse, SubmitAgentMessageFeedbackRequest>(
    `/rpc/chat/inbox/${agentId}/messages/${messageId}/feedback`,
    input,
  )
}

export function getAgentGroupChats() {
  return http.get<AgentGroupChatListResponse>('/rpc/chat/group')
}

export function createAgentGroupChat(input: CreateAgentGroupChatRequest) {
  return http.post<CreateAgentGroupChatResponse, CreateAgentGroupChatRequest>('/rpc/chat/group', input)
}

export function getAgentGroupChatDetail(groupChatId: string) {
  return http.get<AgentGroupChatDetailResponse>(`/rpc/chat/group/${groupChatId}`)
}

export function getAgentGroupChatMessages(groupChatId: string, cursor: string) {
  return http.get<AgentGroupChatMessagesResponse>(`/rpc/chat/group/${groupChatId}/messages?cursor=${encodeURIComponent(cursor)}`)
}

export function addAgentGroupChatMembers(groupChatId: string, input: AddAgentGroupChatMembersRequest) {
  return http.post<AddAgentGroupChatMembersResponse, AddAgentGroupChatMembersRequest>(
    `/rpc/chat/group/${groupChatId}/members`,
    input,
  )
}

export function removeAgentGroupChatMember(groupChatId: string, memberId: string) {
  return http.delete<{ success: true }>(`/rpc/chat/group/${groupChatId}/members/${memberId}`)
}

export function sendAgentGroupChatMessage(input: SendAgentGroupChatMessageRequest) {
  return http.post<SendAgentGroupChatMessageResponse, SendAgentGroupChatMessageRequest>('/rpc/chat/group/send', input)
}

export function createMyAgentCompanion(input: CreateMyAgentCompanionRequest) {
  return http.post<CreateMyAgentCompanionResponse, CreateMyAgentCompanionRequest>('/rpc/agent/my/create', input)
}

export function getMyAgentCompanionDetail(agentId: string) {
  return http.get<MyAgentCompanionDetailResponse>(`/rpc/agent/my/${agentId}`)
}

export function getMyAgentMemories(agentId: string) {
  return http.get<MyAgentMemoriesResponse>(`/rpc/agent/my/${agentId}/memories`)
}

export function getAgentCarePlan(agentId: string) {
  return http.get<AgentCarePlanResponse>(`/rpc/agent/my/${agentId}/care-plan`)
}

export function updateAgentCarePlan(agentId: string, input: UpsertAgentCarePlanRequest) {
  return http.patch<AgentCarePlanResponse, UpsertAgentCarePlanRequest>(`/rpc/agent/my/${agentId}/care-plan`, input)
}

export function getAgentCareEvents(agentId: string) {
  return http.get<AgentCareEventsResponse>(`/rpc/agent/my/${agentId}/care-events`)
}

export function generateAgentCareEvent(agentId: string, input: GenerateAgentCareEventRequest) {
  return http.post<GenerateAgentCareEventResponse, GenerateAgentCareEventRequest>(
    `/rpc/agent/my/${agentId}/care-events/generate`,
    input,
  )
}

export function updateMyAgentMemory(agentId: string, memoryId: string, input: UpdateAgentMemoryRequest) {
  return http.patch<UpdateAgentMemoryResponse, UpdateAgentMemoryRequest>(`/rpc/agent/my/${agentId}/memories/${memoryId}`, input)
}

export function deleteMyAgentMemory(agentId: string, memoryId: string) {
  return http.delete<{ success: true }>(`/rpc/agent/my/${agentId}/memories/${memoryId}`)
}

export function updateMyAgentCompanion(agentId: string, input: UpdateMyAgentCompanionRequest) {
  return http.patch<UpdateMyAgentCompanionResponse, UpdateMyAgentCompanionRequest>(`/rpc/agent/my/${agentId}`, input)
}

export function uploadMyAgentCompanionImage(file: File) {
  const formData = new FormData()
  formData.set('file', file)

  return http.post<UploadMyAgentCompanionImageResponse, FormData>('/rpc/agent/my/image/upload', formData)
}
