import { Service, Stylist, Client, PlanAppointment } from '../types';
import { supabase } from '../lib/supabase';

// Square API Types (Simplified)
interface SquareLocation {
    id: string;
    name: string;
    business_name: string;
    timezone: string;
    status: string;
}

// Support both OAuth and manual token-based authentication
export const isSquareTokenMissing = false;

async function squareApiFetch<T>(path: string, options: { method?: string, body?: any } = {}): Promise<T> {
    const { method = 'GET', body } = options;

    // Get the current Supabase session to pass auth to the proxy
    const { data: { session } } = await supabase.auth.getSession();

    // Route all Square API calls through the server proxy to avoid CORS issues
    const headers: any = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Square-Version': '2023-10-20',
    };

    // If we have a Supabase session, use it; otherwise the proxy will fall back to stored token
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`/api/square/proxy?path=${encodeURIComponent(path)}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        data = { error: { detail: text } };
    }

    if (!response.ok) {
        const err = data.errors?.[0];
        const fieldInfo = err?.field ? ` (Field: ${err.field})` : '';
        throw new Error(err ? `${err.detail}${fieldInfo}` : `Square API Error: ${response.status}`);
    }
    return data as T;
}


export const SquareIntegrationService = {
  formatDate(date: Date, timezone: string = 'UTC') {
    if (!date || isNaN(date.getTime())) {
        return new Date().toISOString();
    }

    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZoneName: 'shortOffset'
        });

        const parts = formatter.formatToParts(date);
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

        const Y = getPart('year');
        const M = getPart('month');
        const D = getPart('day');
        const h = getPart('hour');
        const m = getPart('minute');
        const s = getPart('second');
        let tz = getPart('timeZoneName');

        let offset = '+00:00';
        if (tz === 'UTC' || tz === 'GMT') {
            offset = '+00:00';
        } else {
            let numeric = tz.replace('GMT', '');
            if (numeric.includes(':')) {
                offset = numeric;
            } else {
                const sign = numeric.startsWith('-') ? '-' : '+';
                const hours = numeric.replace(/[+-]/, '').padStart(2, '0');
                offset = `${sign}${hours}:00`;
            }
        }

        return `${Y}-${M}-${D}T${h}:${m}:${s}${offset}`;
    } catch (e) {
        console.error("[Date Formatter Error]", e);
        return date.toISOString();
    }
  },
  
  fetchLocation: async (): Promise<SquareLocation> => {
      const data: any = await squareApiFetch('/v2/locations');
      const activeLocation = data.locations?.find((loc: any) => loc.status === 'ACTIVE');
      if (!activeLocation) throw new Error("No active location found.");
      return activeLocation;
  },

  fetchBusinessDetails: async (): Promise<string> => {
      const loc = await SquareIntegrationService.fetchLocation();
      return loc.business_name || loc.name;
  },

  fetchMerchantDetails: async (merchantId: string): Promise<{ business_name: string }> => {
      const data: any = await squareApiFetch(`/v2/merchants/${merchantId}`);
      const merchant = data.merchant;
      if (!merchant) throw new Error("Could not retrieve merchant details.");
      return { business_name: merchant.business_name || 'Admin' };
  },

  fetchCatalog: async (): Promise<Service[]> => {
    const data: any = await squareApiFetch('/v2/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY');
    const objects = data.objects || [];
    const items = objects.filter((o: any) => o.type === 'ITEM');
    const variations = objects.filter((o: any) => o.type === 'ITEM_VARIATION');
    const categories = objects.filter((o: any) => o.type === 'CATEGORY');

    const services: Service[] = [];

    variations.forEach((variation: any) => {
        const item = items.find((i: any) => i.id === variation.item_variation_data.item_id);
        if (item) {
            const categoryObj = categories.find((c: any) => c.id === item.item_data.category_id);
            const priceMoney = variation.item_variation_data.price_money;
            const durationMs = variation.item_variation_data.service_duration;

            services.push({
                id: variation.id,
                version: variation.version,
                name: `${item.item_data.name}${variation.item_variation_data.name !== 'Regular' ? ` - ${variation.item_variation_data.name}` : ''}`.trim(),
                category: categoryObj?.category_data?.name || 'Uncategorized',
                cost: priceMoney ? Number(priceMoney.amount) / 100 : 0,
                duration: durationMs ? durationMs / 1000 / 60 : 0,
            });
        }
    });
    return services;
  },

  fetchTeam: async (): Promise<Stylist[]> => {
      try {
          const res = await fetch('/api/square/team');
          if (!res.ok) {
              const errorText = await res.text();
              console.error('Square team fetch failed via proxy:', res.status, errorText);
              return [];
          }

          const json = await res.json();
          const members = json.team_members || [];

          if (members.length === 0) {
              return [];
          }

          return members.map((member: any) => ({
              id: member.id,
              name: `${member.given_name} ${member.family_name}`,
              role: member.is_owner ? 'Owner' : 'Team Member',
              email: member.email_address,
              levelId: 'lvl_2',
              permissions: {
                  canBookAppointments: true,
                  canOfferDiscounts: false,
                  requiresDiscountApproval: true,
                  viewGlobalReports: false,
                  viewClientContact: true,
                  viewAllSalonPlans: false,
                  can_book_own_schedule: true,
                  can_book_peer_schedules: false,
              }
          }));
      } catch (err) {
          console.error('Failed to load Square team members from proxy:', err);
          return [];
      }
  },

  fetchCustomers: async (): Promise<Partial<Client>[]> => {
      let cursor: string | undefined = undefined;
      const allCustomers: any[] = [];

      do {
          const path = `/v2/customers/list${cursor ? `?cursor=${cursor}` : ''}`;
          const data: any = await squareApiFetch(path);
          
          if (data.customers) {
              allCustomers.push(...data.customers);
          }
          cursor = data.cursor;
      } while(cursor);
      
      return allCustomers.map((c: any) => ({
        id: c.id,
        externalId: c.id,
        name: `${c.given_name || ''} ${c.family_name || ''}`.trim() || c.email_address || 'Unnamed Client',
        email: c.email_address,
        phone: c.phone_number,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(`${c.given_name || ''} ${c.family_name || ''}`.trim() || c.email_address || 'UC')}&background=random`,
      }));
  },

  searchCustomer: async (name: string): Promise<string | null> => {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      const body: any = {
          query: {
              filter: {},
              sort: {
                  field: "CREATED_AT",
                  order: "DESC"
              }
          },
          limit: 1
      };
      
      if (lastName) {
          body.query.filter.given_name = { exact: firstName };
          body.query.filter.family_name = { exact: lastName };
      } else if (firstName) {
          body.query.filter.given_name = { exact: firstName };
      }

      const data: any = await squareApiFetch('/v2/customers/search', {
          method: 'POST',
          body: body
      });
      
      const customer = data.customers?.[0];
      return customer ? customer.id : null;
  },

  findAvailableSlots: async (params: {
      locationId: string,
      startAt: string,
      teamMemberId: string,
      serviceVariationId: string
  }): Promise<string[]> => {
      const startDate = new Date(params.startAt);
      if (isNaN(startDate.getTime())) throw new Error("Invalid start time passed to Square.");

      // Validate that service variation ID doesn't start with 's' (mock ID)
      if (params.serviceVariationId.startsWith('s')) {
          throw new Error(`Invalid service ID: ${params.serviceVariationId}. Service catalog may not be synced from Square. Please ensure your salon's services are synced in Square Bookings settings.`);
      }

      const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));

      const segment_filter: {
          service_variation_id: string;
          team_member_id_filter?: { any: string[] };
      } = {
          service_variation_id: params.serviceVariationId,
      };

      const teamMemberId = params.teamMemberId;
      const isInvalidForFilter = !teamMemberId || teamMemberId.startsWith('TM-') || teamMemberId === 'admin' || teamMemberId.length < 10;

      console.log('[BOOKING] Team member ID:', teamMemberId, 'isInvalidForFilter:', isInvalidForFilter);

      if (!isInvalidForFilter) {
          segment_filter.team_member_id_filter = { any: [teamMemberId] };
      }

      const body = {
          query: {
              filter: {
                  location_id: params.locationId,
                  start_at_range: {
                      start_at: params.startAt,
                      end_at: endDate.toISOString()
                  },
                  segment_filters: [segment_filter]
              }
          }
      };

      const data: any = await squareApiFetch('/v2/bookings/availability/search', { method: 'POST', body });
      const slots = (data.availabilities || [])
          .map((a: any) => a.start_at);
      
      return slots;
  },

  fetchAllBookings: async (locationId: string): Promise<any[]> => {
    let cursor: string | undefined = undefined;
    const allBookings: any[] = [];
    
    do {
        const path = `/v2/bookings?location_id=${locationId}${cursor ? `&cursor=${cursor}` : ''}`;
        const data: any = await squareApiFetch(path);
        if (data.bookings) {
            allBookings.push(...data.bookings);
        }
        cursor = data.cursor;
    } while (cursor);

    return allBookings;
  },

  createAppointment: async (bookingDetails: {
      locationId: string;
      startAt: string; 
      customerId: string;
      teamMemberId: string;
      services: Service[];
  }): Promise<any> => {
      const { locationId, startAt, customerId, teamMemberId, services } = bookingDetails;
      
      if (!locationId) throw new Error("Location ID is required for booking.");
      if (!customerId) throw new Error("Customer ID is required for booking.");

      let resolvedTeamMemberId = teamMemberId;
      const isInvalidTeamMemberId = !teamMemberId || teamMemberId.startsWith('TM-') || teamMemberId === 'admin';

      if (isInvalidTeamMemberId) {
          const teamMembers = await SquareIntegrationService.fetchTeam();
          if (!teamMembers || teamMembers.length === 0) {
              throw new Error("No bookable team members found in Square to assign this appointment to.");
          }
          resolvedTeamMemberId = teamMembers[0].id;
      }
      
      const serviceVersionMap = new Map<string, number>();
      services.forEach(s => {
          if (s.id && s.version) {
              serviceVersionMap.set(s.id, s.version);
          }
      });

      const body = {
          booking: {
              location_id: locationId,
              start_at: startAt,
              customer_id: customerId,
              appointment_segments: services.map(service => ({
                  team_member_id: resolvedTeamMemberId,
                  service_variation_id: service.id,
                  service_variation_version: serviceVersionMap.get(service.id) || undefined
              }))
          }
      };

      return await squareApiFetch('/v2/bookings', { method: 'POST', body });
  },
};
