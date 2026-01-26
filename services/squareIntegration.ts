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
        const errorMessage = err?.detail || 'Unknown error';
        console.error('[SQUARE API ERROR] Full response:', JSON.stringify(data, null, 2));
        throw new Error(`Square API Error (${response.status}): ${errorMessage}${fieldInfo}`);
    }
    return data as T;
}


export const SquareIntegrationService = {
  formatDate(date: Date, timezone?: string) {
    if (!date || isNaN(date.getTime())) {
        return new Date().toISOString().split('.')[0] + 'Z';
    }

    // Square Bookings API requires RFC 3339 format: YYYY-MM-DDTHH:mm:ssZ (UTC, no milliseconds)
    // This matches the official Square API documentation format
    return date.toISOString().split('.')[0] + 'Z';
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
    let cursor: string | undefined = undefined;
    const allObjects: any[] = [];
    let pageCount = 0;

    // Fetch all pages of the catalog
    do {
        const path = `/v2/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        console.log('[CATALOG] Fetching page', pageCount + 1, 'cursor:', cursor ? cursor.substring(0, 20) + '...' : 'none');
        const data: any = await squareApiFetch(path);

        if (data.objects) {
            console.log('[CATALOG] Page', pageCount + 1, 'returned', data.objects.length, 'objects');
            allObjects.push(...data.objects);
        }
        cursor = data.cursor;
        pageCount++;
        console.log('[CATALOG] Next cursor:', cursor ? 'exists' : 'none (end of pages)');
    } while (cursor);

    console.log('[CATALOG] Total objects fetched across', pageCount, 'pages:', allObjects.length);

    const items = allObjects.filter((o: any) => o.type === 'ITEM');
    const variations = allObjects.filter((o: any) => o.type === 'ITEM_VARIATION');
    console.log('[CATALOG] Breakdown - Items:', items.length, 'Variations:', variations.length);
    console.log('[CATALOG] All items:', items.map(i => ({ id: i.id, name: i.item_data?.name })));
    console.log('[CATALOG] All variations:', variations.map(v => ({ id: v.id, itemId: v.item_variation_data?.item_id, name: v.item_variation_data?.name })));

    const items = allObjects.filter((o: any) => o.type === 'ITEM');
    const variations = allObjects.filter((o: any) => o.type === 'ITEM_VARIATION');
    const categories = allObjects.filter((o: any) => o.type === 'CATEGORY');

    const services: Service[] = [];

    variations.forEach((variation: any) => {
        const item = items.find((i: any) => i.id === variation.item_variation_data.item_id);
        if (item) {
            const categoryObj = categories.find((c: any) => c.id === item.item_data.category_id);
            const priceMoney = variation.item_variation_data.price_money;
            const durationMs = variation.item_variation_data.service_duration;

            const serviceName = `${item.item_data.name}${variation.item_variation_data.name !== 'Regular' ? ` - ${variation.item_variation_data.name}` : ''}`.trim();

            services.push({
                id: variation.id,
                version: variation.version,
                name: serviceName,
                category: categoryObj?.category_data?.name || 'Uncategorized',
                cost: priceMoney ? Number(priceMoney.amount) / 100 : 0,
                duration: durationMs ? durationMs / 1000 / 60 : 0,
            });
        }
    });

    console.log('[CATALOG] Available services (total):', services.length, services.map(s => ({ name: s.name, id: s.id })));
    return services;
  },

  fetchTeam: async (): Promise<Stylist[]> => {
      try {
          const data: any = await squareApiFetch('/v2/team-members/search', { method: 'POST', body: { query: { filter: {} }, limit: 100 } });
          const members = data.team_members || [];

          if (members.length === 0) {
              return [];
          }

          console.log('[TEAM] Fetched team members:', members.map((m: any) => ({ id: m.id, name: `${m.given_name} ${m.family_name}` })));

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
          console.error('Failed to load Square team members:', err);
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
      // startAt is already formatted by the caller, just validate it
      if (!params.startAt || !params.startAt.includes('T')) {
          throw new Error("Invalid start time format passed to Square.");
      }

      // Parse the start date to calculate end date
      let startDate: Date;
      try {
          startDate = new Date(params.startAt);
          if (isNaN(startDate.getTime())) throw new Error("Invalid date");
      } catch (e) {
          throw new Error("Invalid start time: " + params.startAt);
      }

      // Use a 30-day window for availability search
      const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000));
      // Format end_at as UTC with Z format - must remove milliseconds to match Square API format
      const endAtFormatted = SquareIntegrationService.formatDate(endDate);

      console.log('[AVAILABILITY] Searching from', params.startAt, 'to', endAtFormatted);
      console.log('[AVAILABILITY] Full params received:', {
          locationId: params.locationId,
          startAt: params.startAt,
          teamMemberId: params.teamMemberId,
          serviceVariationId: params.serviceVariationId,
          teamMemberIdType: typeof params.teamMemberId,
          teamMemberIdStartsWithTM: params.teamMemberId?.startsWith?.('TM')
      });

      // Build segment filter with both service and team member
      const segmentFilter: any = {
          service_variation_id: params.serviceVariationId
      };

      // Include team_member_id_filter if we have a valid team member ID (MUST start with TM)
      if (params.teamMemberId && String(params.teamMemberId).startsWith('TM')) {
          segmentFilter.team_member_id_filter = {
              any: [params.teamMemberId]
          };
          console.log('[AVAILABILITY] Added team_member_id_filter:', params.teamMemberId);
      } else {
          console.warn('[AVAILABILITY] Team member ID invalid or missing:', params.teamMemberId, 'type:', typeof params.teamMemberId);
      }

      const body = {
          query: {
              filter: {
                  location_id: params.locationId,
                  start_at_range: {
                      start_at: params.startAt,
                      end_at: endAtFormatted
                  },
                  segment_filters: [segmentFilter]
              }
          }
      };

      console.log('[BOOKING AVAILABILITY] Request body:');
      console.log(JSON.stringify(body, null, 2));
      console.log('[BOOKING AVAILABILITY] Details:');
      console.log({
          location_id: params.locationId,
          service_variation_id: params.serviceVariationId,
          team_member_id: params.teamMemberId,
          start_at: params.startAt,
          end_at: endAtFormatted
      });

      const data: any = await squareApiFetch('/v2/bookings/availability/search', { method: 'POST', body });
      const slots = (data.availabilities || [])
          .map((a: any) => a.start_at);

      console.log('[AVAILABILITY] Returned', slots.length, 'available slots');
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
