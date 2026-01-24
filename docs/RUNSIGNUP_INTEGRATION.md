# RunSignup Integration Strategy

## Current State

**Status**: Deprecated / Not actively maintained

**Current Integration**: Basic race parsing from RunSignup URLs

**Issues**:
- Integration is unreliable
- API limitations
- Data quality issues
- Maintenance burden

---

## Decision: Curate Our Own Races

**Strategy**: Build our own race registry (`race_registry` model) and use RunSignup (and other race platforms) as referral sources only.

### Approach

1. **Curate races manually** or via import
2. **Store full race data** in `race_registry` model
3. **Use "Sign Up Here" links** for referrals to:
   - RunSignup
   - Active.com
   - Race websites
   - Other registration platforms
4. **Track referrals** (optional - for analytics)

### Benefits

- ✅ Full control over race data
- ✅ Consistent data structure
- ✅ No dependency on external APIs
- ✅ Better user experience
- ✅ Can add our own value (training plans, RunCrew training, etc.)

### Implementation

**`race_registry.registrationUrl`** field stores the referral link:
- Can point to RunSignup
- Can point to race website
- Can point to any registration platform
- We just provide the link, they handle registration

**Future Enhancement**: Track referral clicks (analytics) if needed.

---

## Migration Path

1. ✅ Expand `race_registry` model with all fields
2. ✅ Migrate existing race data
3. ✅ Update race creation/editing to use new fields
4. ✅ Update UI to show registration links
5. ⏳ Remove RunSignup integration code (later, low priority)

---

## Notes

- RunSignup integration code can stay for now (just not actively maintained)
- Focus on building out `race_registry` as the spine
- Use registration URLs as referral links
- More on referral tracking later

