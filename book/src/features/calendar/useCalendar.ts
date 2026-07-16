import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAppointments, createAppointment, getClients, getProfiles, updateAppointment, deleteAppointment, updateProfile, getMonthlyAppointments, updateClient, getAppointmentsByClient, getTicketPackages, getGlobalAds } from './api'
import { createClient } from '@/features/clients/api'

/** 고객 목록 조회 훅 */
export function useClients() {
    return useQuery({
        queryKey: ['clients'],
        queryFn: () => getClients(),
        staleTime: 2 * 60 * 1000, // 2분 캐싱
        refetchOnWindowFocus: false,
    })
}

/** 패키지 상품 목록 조회 훅 */
export function useTicketPackages(systemId?: string | null) {
    return useQuery({
        queryKey: ['ticketPackages', systemId],
        queryFn: () => getTicketPackages(systemId || undefined),
        enabled: !!systemId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    })
}

/** 활성화된 전역 광고 조회 */
export function useGlobalAds() {
    return useQuery({
        queryKey: ['globalAds'],
        queryFn: () => getGlobalAds(),
        staleTime: 5 * 60 * 1000, // 5분 캐싱
        refetchOnWindowFocus: false,
    })
}

/** 고객 정보 수정 훅 */
export function useUpdateClient() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<import('@/types/db').Client> }) =>
            updateClient(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] })
        },
    })
}

/** 선생님/직원 프로필 조회 훅 (같은 시스템 소속만) */
export function useProfiles(systemId?: string | null) {
    return useQuery({
        queryKey: ['profiles', systemId],
        queryFn: () => getProfiles(systemId || undefined),
        enabled: !!systemId,
        staleTime: 5 * 60 * 1000, // 5분 캐싱
        refetchOnWindowFocus: false,
    })
}

/** 특정 날짜/주간의 예약 목록 조회 훅 */
export function useAppointments(date: Date) {
    return useQuery({
        queryKey: ['appointments', date],
        queryFn: () => getAppointments(date),
        staleTime: 30 * 1000, // 30초 캐싱 (실시간 수신과 조합)
        refetchOnWindowFocus: false,
    })
}

/** 예약 생성 훅 */
export function useCreateAppointment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createAppointment,
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['appointments'] })
        },
    })
}

/** 예약 수정 훅 */
export function useUpdateAppointment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<import('@/types/db').Appointment> }) =>
            updateAppointment(id, updates),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['appointments'] })
        },
    })
}

/** 고객 생성 훅 */
export function useCreateClient() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createClient,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] })
        },
    })
}

/** 예약 삭제 훅 */
export function useDeleteAppointment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => deleteAppointment(id),
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['appointments'] })
        },
    })
}

/** 프로필 업데이트 훅 */
export function useUpdateProfile() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<import('@/types/db').Profile> }) =>
            updateProfile(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
            queryClient.invalidateQueries({ queryKey: ['statistics'] })
        },
    })
}

/** 월간 예약 목록 조회 훅 (미니 달력용) */
export function useMonthlyAppointments(date: Date) {
    return useQuery({
        queryKey: ['appointments', 'monthly', date],
        queryFn: () => getMonthlyAppointments(date),
        staleTime: 2 * 60 * 1000, // 2분 캐싱
        refetchOnWindowFocus: false,
    })
}

/** 특정 고객의 모든 예약 목록 조회 훅 (메모 히스토리용) */
export function useClientAppointments(clientId: string | undefined | null) {
    return useQuery({
        queryKey: ['appointments', 'client', clientId],
        queryFn: () => getAppointmentsByClient(clientId!),
        enabled: !!clientId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    })
}
