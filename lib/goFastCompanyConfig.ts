/**
 * GoFast Company Config
 * 
 * Single-tenant configuration for GoFast Company Stack.
 * Since there's only ONE GoFast company, we hardcode the companyId.
 * 
 * This companyId is set once when the company is first created and lives forever.
 */

export const GOFAST_COMPANY_ID = 'cmhpqe7kl0000nw1uvcfhf2hs';

/**
 * Get GoFast Company ID (single tenant - hardcoded)
 * @returns {string} The GoFast Company ID
 */
export const getGoFastCompanyId = () => {
  return GOFAST_COMPANY_ID;
};

