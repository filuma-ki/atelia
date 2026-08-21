export type Client = {
  id: string;
  owner_id: string;

  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  age_group: string | null;
  city: string | null;
  country: string | null;

  // ✅ Billing address (new)
  billing_street: string | null;
  billing_house_number: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;

  body_size: Record<string, any>;
  style: Record<string, any>;
  preferences: Record<string, any>;
  notes: Record<string, any>;

  created_at: string;
  updated_at: string;
};

export type ClientFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  age_group: string;
  city: string;
  country: string;

  // ✅ Billing address (new)
  billing_street: string;
  billing_house_number: string;
  billing_postal_code: string;
  billing_city: string;
  billing_country: string;

  body_size: {
    height_cm?: string;
    fit_preference?: string;
    size_tops?: string[];
    size_bottoms?: string[];
    shoe_size?: string;
    body_notes?: string;
  };

  style: {
    style_types?: string[];
    preferred_colors?: string[];
    avoided_colors?: string[];
    pattern_preference?: string;
    logo_preference?: string;
    typical_occasions?: string[];
  };

  preferences: {
    profession?: string;
    climate?: string;
    travel_frequency?: string;
    social_handle?: string;

    budget_level?: string;
    price_sensitivity?: string;
    shopping_method?: string;
    preferred_stores?: string;

    favorite_brands?: string[];
    disliked_brands?: string[];

    preferred_contact_method?: string;
    response_time?: string;
    communication_notes?: string;
  };

  notes: {
    personality_notes?: string;
    buying_behavior?: string;
    red_flags?: string;
    special_instructions?: string;
  };
};

export const emptyClientFormValues = (): ClientFormValues => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  age_group: "",
  city: "",
  country: "",

  // ✅ Billing address (new)
  billing_street: "",
  billing_house_number: "",
  billing_postal_code: "",
  billing_city: "",
  billing_country: "",

  body_size: { size_tops: [], size_bottoms: [] },
  style: { style_types: [], preferred_colors: [], avoided_colors: [], typical_occasions: [] },
  preferences: { favorite_brands: [], disliked_brands: [] },
  notes: {},
});