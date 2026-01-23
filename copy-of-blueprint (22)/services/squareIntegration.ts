

import { Service, Stylist, Client, PlanAppointment } from '../types';

// Square API Types (Simplified)
interface SquareLocation {
    id: string;
    name: string;
    business_name: string;
    timezone: string;
    status: string;
}

type SquareEnvironment = 'sandbox' | 'production';

const PROD_API_BASE = 'https://connect.squareup.com/v2';
const SANDBOX_API_BASE = 'https://connect.squareupsandbox.com/v2';
const PROXY_URL = 'https://corsproxy.io/?';

/**
 * --- SYSTEM INVARIANT DOCUMENTATION (Development Safety) ---
 *
 * This service acts as the strict boundary between the application and the
 * external Square API.
 *
 * INVARIANT E: CHANGE SAFETY RULES
 * E1) Any patch touching logic in this file MUST be applied in isolation
 *     and tested alone, as it can affect all other parts of the system.
 * E2) UI/copy patches MUST NOT touch any logic in this file.
 *
 * INVARIANT D: SCHEMA & NAMING RULES
 * D2) This file is the translation layer. It is responsible for converting
 *     Square's naming conventions (e.g., 'start_at') to the application's
 *     canonical schema names (e.g., 'start_time'). The application database
 *     schema MUST NOT be changed to mirror Square's naming.
 */
async function fetchFromSquare(endpoint: string, accessToken: string, environment: SquareEnvironment, options: { method?: string, body?: any } = {}) {
    const { method = 'GET', body } = options;
    const baseUrl = environment === 'sandbox' ? SANDBOX_API_BASE : PROD_API_BASE;
    const targetUrl = `${baseUrl}${endpoint}`;
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxiedUrl, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2023-10-20'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    if (!response.ok) {
        const err = data.errors?.[0];
        const fieldInfo = err?.field ? ` (Field: ${err.field})` : '';
        throw new Error(err ? `${err.detail}${fieldInfo}` : `HTTP Error ${response.status}`);
    }
    return data;
}

export const SquareIntegrationService = {
  // FIX: Moved and renamed formatRFC3339WithOffset to formatDate and added to the service object.
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
  
  exchangeCodeForToken: async (code: string, env: SquareEnvironment): Promise<{ accessToken: string, refreshToken: string, merchantId: string }> => {
    const baseUrl = env === 'sandbox' ? SANDBOX_API_BASE : PROD_API_BASE;
    const targetUrl = `${baseUrl}/oauth2/token`;
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

    const response = await fetch(proxiedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // FIX: Suppress TypeScript error for import.meta.env which is a Vite-specific feature.
        // @ts-ignore
        client_id: import.meta.env.VITE_SQUARE_APPLICATION_ID,
        // FIX: Suppress TypeScript error for import.meta.env which is a Vite-specific feature.
        // @ts-ignore
        client_secret: import.meta.env.VITE_SQUARE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        // @ts-ignore
        redirect_uri: import.meta.env.VITE_SQUARE_REDIRECT_URI
      }),
    });

    const data = await response.json();
    if (!response.ok) {
        const err = data.errors?.[0];
        throw new Error(err ? `${err.detail}` : `OAuth Token Exchange Failed: ${response.status}`);
    }
    
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        merchantId: data.merchant_id,
    };
  },
  
  fetchLocation: async (accessToken: string, env: SquareEnvironment): Promise<SquareLocation> => {
      const data = await fetchFromSquare('/locations', accessToken, env);
      const activeLocation = data.locations?.find((loc: any) => loc.status === 'ACTIVE');
      if (!activeLocation) throw new Error("No active location found.");
      return activeLocation;
  },

  fetchBusinessDetails: async (accessToken: string, env: SquareEnvironment): Promise<string> => {
      const loc = await SquareIntegrationService.fetchLocation(accessToken, env);
      return loc.business_name || loc.name;
  },

  fetchMerchantDetails: async (accessToken: string, env: SquareEnvironment, merchantId: string): Promise<{ business_name: string }> => {
      const data = await fetchFromSquare(`/merchants/${merchantId}`, accessToken, env);
      const merchant = data.merchant;
      if (!merchant) throw new Error("Could not retrieve merchant details.");
      return { business_name: merchant.business_name || 'Admin' };
  },

  // FIX: Added fetchCatalog to fetch services from Square.
  fetchCatalog: async (accessToken: string, env: SquareEnvironment): Promise<Service[]> => {
    const data = await fetchFromSquare('/catalog/list?types=ITEM,ITEM_VARIATION,CATEGORY', accessToken, env);
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
                id: variation.id, // Use variation ID as it's what's booked
                version: variation.version,
                name: `${item.item_data.name}${variation.item_variation_data.name !== 'Regular' ? ` - ${variation.item_variation_data.name}` : ''}`.trim(),
                category: categoryObj?.category_data?.name || 'Uncategorized',
                cost: priceMoney ? Number(priceMoney.amount) / 100 : 0,
                duration: durationMs ? durationMs / 1000 / 60 : 0, // Convert ms to minutes
            });
        }
    });
    return services;
  },

  // FIX: Added fetchTeam to fetch stylists from Square.
  fetchTeam: async (accessToken: string, env: SquareEnvironment): Promise<Stylist[]> => {
      const data = await fetchFromSquare('/team-members/search', accessToken, env, {
          method: 'POST',
          body: {
              query: {
                  filter: {
                      status: 'ACTIVE',
                  }
              }
          }
      });
      const members = data.team_members || [];
      return members.map((member: any) => ({
          id: member.id, // external Square ID
          name: `${member.given_name} ${member.family_name}`,
          role: member.is_owner ? 'Owner' : 'Team Member',
          email: member.email_address,
          levelId: 'lvl_2', // Default level
          permissions: { // Default permissions
              canBookAppointments: true,
              canOfferDiscounts: false,
              requiresDiscountApproval: true,
              viewGlobalReports: false,
              viewClientContact: true,
              viewAllSalonPlans: false,
          }
      }));
  },

  // FIX: Added fetchCustomers to fetch clients from Square.
  fetchCustomers: async (accessToken: string, env: SquareEnvironment): Promise<Partial<Client>[]> => {
      let cursor: string | undefined = undefined;
      const allCustomers: any[] = [];

      do {
          const url = `/customers/list${cursor ? `?cursor=${cursor}` : ''}`;
          const data = await fetchFromSquare(url, accessToken, env);
          
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

  // FIX: Added searchCustomer to find a client by name in Square.
  searchCustomer: async (accessToken: string, env: SquareEnvironment, name: string): Promise<string | null> => {
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
          // Fallback for single name
          body.query.filter.given_name = { exact: firstName };
      }


      const data = await fetchFromSquare('/customers/search', accessToken, env, {
          method: 'POST',
          body: body
      });
      
      const customer = data.customers?.[0];
      return customer ? customer.id : null;
  },

  findAvailableSlots: async (accessToken: string, env: SquareEnvironment, params: {
      locationId: string,
      startAt: string,
      teamMemberId: string,
      serviceVariationId: string
  }): Promise<string[]> => {
      const startDate = new Date(params.startAt);
      if (isNaN(startDate.getTime())) throw new Error("Invalid start time passed to Square.");

      // Search a 30-day window to populate the calendar view
      const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000)); 

      const segment_filter: {
          service_variation_id: string;
          team_member_id_filter?: { any: string[] };
      } = {
          service_variation_id: params.serviceVariationId,
      };

      // A valid Square team member ID must be provided. Internal IDs like 'admin' or
      // mock IDs like 'TM-...' are not valid for the Square API filter.
      // If the provided ID is not a valid-looking Square ID, we omit the filter to search
      // across all available team members. The final booking will resolve a correct ID.
      const teamMemberId = params.teamMemberId;
      const isInvalidForFilter = !teamMemberId || teamMemberId.startsWith('TM-') || teamMemberId === 'admin';

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

      const data = await fetchFromSquare('/bookings/availability/search', accessToken, env, { method: 'POST', body });
      const slots = (data.availabilities || [])
          .map((a: any) => a.start_at);
      
      return slots;
  },

  fetchAllBookings: async (accessToken: string, env: SquareEnvironment, locationId: string): Promise<any[]> => {
    let cursor = undefined;
    const allBookings: any[] = [];
    
    do {
        const url = `/bookings?location_id=${locationId}${cursor ? `&cursor=${cursor}` : ''}`;
        const data = await fetchFromSquare(url, accessToken, env);
        if (data.bookings) {
            allBookings.push(...data.bookings);
        }
        cursor = data.cursor;
    } while (cursor);

    return allBookings;
  },

  createAppointment: async (accessToken: string, env: SquareEnvironment, bookingDetails: {
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
          // Fetch all bookable team members from Square.
          // FIX: Call the newly added fetchTeam method correctly.
          const teamMembers = await SquareIntegrationService.fetchTeam(accessToken, env);
          if (!teamMembers || teamMembers.length === 0) {
              throw new Error("No bookable team members found in Square to assign this appointment to.");
          }
          // Use the first available team member as the fallback default.
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

      return await fetchFromSquare('/bookings', accessToken, env, { method: 'POST', body });
  },
};
