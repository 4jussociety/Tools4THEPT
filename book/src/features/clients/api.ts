// 고객관리 API 함수: 고객 CRUD 및 목록 조회

import { supabase } from '@/lib/supabase'
import type { Client } from '@/types/db'

export type ClientWithDetails = Client & {
    last_instructor_name?: string
    first_visit?: string
    next_appointment?: {
        start_time: string
        end_time: string
        instructor_name: string
    }
    active_tickets?: {
        id: string
        name: string
        used_sessions: number
        total_sessions: number
    }[]
}

export async function getClients(systemId?: string, search?: string): Promise<ClientWithDetails[]> {
    let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

    if (systemId) {
        query = query.eq('system_id', systemId)
    }

    if (search) {
        query = query.ilike('name', `%${search}%`)
    }

    const { data: clients, error } = await query
    if (error) return []

    if (!clients || clients.length === 0) return []

    const clientIds = clients.map(p => p.id)

    // 최근 예약 데이터 조회
    let firstVisitMap = new Map<string, string>()
    let instructorMap = new Map<string, string>()
    let nextApptMap = new Map<string, { start_time: string; end_time: string; instructor_name: string }>()
    let activeTicketsMap = new Map<string, { id: string; name: string; used_sessions: number; total_sessions: number }[]>()

    try {
        const { data: firstVisits } = await supabase
            .from('appointments')
            .select('client_id, start_time')
            .in('client_id', clientIds)
            .order('start_time', { ascending: true })

        firstVisits?.forEach(fv => {
            if (!firstVisitMap.has(fv.client_id)) {
                firstVisitMap.set(fv.client_id, fv.start_time)
            }
        })
    } catch { /* 안전 무시 */ }

    try {
        const { data: activeTicketsData } = await supabase
            .from('client_tickets')
            .select('id, client_id, name, used_sessions, total_sessions')
            .in('client_id', clientIds)
            .eq('status', 'ACTIVE')

        activeTicketsData?.forEach((m: Record<string, unknown>) => {
            const cId = m.client_id as string
            if (!activeTicketsMap.has(cId)) {
                activeTicketsMap.set(cId, [])
            }
            activeTicketsMap.get(cId)!.push({
                id: m.id as string,
                name: m.name as string,
                used_sessions: m.used_sessions as number,
                total_sessions: m.total_sessions as number,
            })
        })
    } catch { /* 안전 무시 */ }

    return clients.map(p => ({
        ...p,
        last_instructor_name: instructorMap.get(p.id) || undefined,
        first_visit: firstVisitMap.get(p.id) || undefined,
        next_appointment: nextApptMap.get(p.id) || undefined,
        active_tickets: activeTicketsMap.get(p.id) || undefined,
    })) as ClientWithDetails[]
}

export async function createClient(client: Partial<Client>) {
    try {
        // 1차 시도: 전체 필드로 등록
        const { data, error } = await supabase
            .from('clients')
            .insert(client)
            .select()
            .single()

        if (!error && data) return data as Client

        // 2차 시도 (DB 미등록 컬럼 예외 방어): 기본 필수 필드만 추출하여 등록
        const fallbackClient = {
            name: client.name,
            phone: client.phone || null,
            chart_number: client.chart_number || null,
            memo: client.memo || null,
            system_id: client.system_id || null,
            gender: client.gender || null,
            birth_date: client.birth_date || null,
        }

        const { data: fallbackData, error: fallbackError } = await supabase
            .from('clients')
            .insert(fallbackClient)
            .select()
            .single()

        if (fallbackError) throw fallbackError
        return fallbackData as Client
    } catch (err) {
        console.error('[createClient Error]', err)
        throw err
    }
}

export async function updateClient(id: string, updates: Partial<Client>) {
    try {
        const { data, error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (!error && data) return data as Client

        const fallbackUpdates = {
            name: updates.name,
            phone: updates.phone,
            chart_number: updates.chart_number,
            memo: updates.memo,
            gender: updates.gender,
            birth_date: updates.birth_date,
            system_id: updates.system_id,
        }

        const { data: fallbackData, error: fallbackError } = await supabase
            .from('clients')
            .update(fallbackUpdates)
            .eq('id', id)
            .select()
            .single()

        if (fallbackError) throw fallbackError
        return fallbackData as Client
    } catch (err) {
        console.error('[updateClient Error]', err)
        throw err
    }
}

export async function deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
}
