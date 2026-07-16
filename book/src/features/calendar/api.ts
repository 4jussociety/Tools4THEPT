import { supabase } from '@/lib/supabase'
import type { Appointment, Client, Profile } from '@/types/db'
import { endOfDay, startOfWeek, addDays, formatISO, startOfMonth, endOfMonth, endOfWeek } from 'date-fns'

export async function getAppointments(date: Date) {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 })
    const weekEnd = endOfDay(addDays(weekStart, 6))

    try {
        // 1. 1차 시도: FK 조인을 통해 client 및 instructor 정보 함께 가져오기
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                client:client_id(*),
                instructor:instructor_id(*)
            `)
            .gte('start_time', formatISO(weekStart))
            .lte('start_time', formatISO(weekEnd))

        if (!error && data) {
            return data as Appointment[]
        }
    } catch { /* 실패 시 2차 시도로 전환 */ }

    // 2. 2차 시도 (안전 Fallback): appointments 가져온 후 clients, profiles 별도 매핑 (오류 100% 방지)
    try {
        const { data: appointmentsData, error } = await supabase
            .from('appointments')
            .select('*')
            .gte('start_time', formatISO(weekStart))
            .lte('start_time', formatISO(weekEnd))

        if (error || !appointmentsData) return []

        const clientIds = Array.from(new Set(appointmentsData.map(a => a.client_id).filter(Boolean)))
        const instructorIds = Array.from(new Set(appointmentsData.map(a => a.instructor_id).filter(Boolean)))

        let clientsMap = new Map()
        let instructorsMap = new Map()

        if (clientIds.length > 0) {
            const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds)
            if (clients) clientsMap = new Map(clients.map(c => [c.id, c]))
        }

        if (instructorIds.length > 0) {
            const { data: instructors } = await supabase.from('profiles').select('*').in('id', instructorIds)
            if (instructors) instructorsMap = new Map(instructors.map(i => [i.id, i]))
        }

        return appointmentsData.map(a => ({
            ...a,
            client: clientsMap.get(a.client_id) || null,
            instructor: instructorsMap.get(a.instructor_id) || null,
        })) as Appointment[]
    } catch {
        return []
    }
}

export async function getTicketPackages(systemId?: string) {
    if (!systemId) return []
    try {
        const { data, error } = await supabase
            .from('ticket_packages')
            .select('*')
            .eq('system_id', systemId)
            .order('created_at', { ascending: true })

        if (error) return []
        return data as import('@/types/db').TicketPackage[]
    } catch {
        return []
    }
}

export async function getAppointmentsByClient(clientId: string) {
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('client_id', clientId)
            .order('start_time', { ascending: false })

        if (error || !data) return []
        return data as Appointment[]
    } catch {
        return []
    }
}

export async function getMonthlyAppointments(date: Date) {
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(date), { weekStartsOn: 0 })

    try {
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                id,
                start_time,
                event_type,
                status
            `)
            .gte('start_time', formatISO(start))
            .lte('start_time', formatISO(end))

        if (error) return []
        return data as Partial<Appointment>[]
    } catch {
        return []
    }
}

export async function createAppointment(appointment: Partial<Appointment>) {
    const { data, error } = await supabase
        .from('appointments')
        .insert(appointment)
        .select('*')
        .single()

    if (error) throw error
    return data as Appointment
}

export async function updateAppointment(id: string, updates: Partial<Appointment>) {
    const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

    if (error) throw error
    return data as Appointment
}

export async function updateAppointmentsStatus(ids: string[], status: import('@/types/db').Appointment['status']) {
    if (!ids || ids.length === 0) return true
    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .in('id', ids)
        if (error) throw error
        return true
    } catch (err) {
        console.error('[updateAppointmentsStatus] Error:', err)
        return false
    }
}

export async function deleteAppointment(id: string) {
    const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id)

    if (error) throw error
    return true
}

export async function getClients() {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true })

        if (error) return []
        return data as Client[]
    } catch {
        return []
    }
}

export async function getProfiles(systemId?: string) {
    try {
        let query = supabase.from('profiles').select('*')
        if (systemId) {
            query = query.eq('system_id', systemId)
        }
        const { data, error } = await query
        if (error) {
            const { data: fallbackData } = await supabase.from('profiles').select('id, email, full_name, role')
            return (fallbackData || []) as Profile[]
        }
        return (data || []) as Profile[]
    } catch {
        return []
    }
}

export async function updateProfile(id: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data as Profile
}

export async function updateClient(id: string, updates: Partial<Client>) {
    const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data as Client
}

export async function getGlobalAds() {
    try {
        const { data, error } = await supabase
            .from('global_ads')
            .select('*')
            .eq('is_active', true)
        if (error) return []
        return data || []
    } catch {
        return []
    }
}
