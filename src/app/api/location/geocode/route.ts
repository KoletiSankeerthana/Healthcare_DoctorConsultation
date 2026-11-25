import { NextRequest, NextResponse } from "next/server";

// Fallback Indian localities dictionary for fast offline/autocomplete lookup
const LOCALITIES = [
  // Chennai
  { name: "Velachery", city: "Chennai", state: "Tamil Nadu", lat: 12.9815, lng: 80.2180, formatted: "Velachery, Chennai, Tamil Nadu" },
  { name: "Adyar", city: "Chennai", state: "Tamil Nadu", lat: 13.0067, lng: 80.2570, formatted: "Adyar, Chennai, Tamil Nadu" },
  { name: "Greams Road, Thousand Lights", city: "Chennai", state: "Tamil Nadu", lat: 13.0604, lng: 80.2505, formatted: "Greams Road, Thousand Lights, Chennai, Tamil Nadu" },
  { name: "Alwarpet", city: "Chennai", state: "Tamil Nadu", lat: 13.0336, lng: 80.2520, formatted: "Alwarpet, Chennai, Tamil Nadu" },
  { name: "Anna Nagar", city: "Chennai", state: "Tamil Nadu", lat: 13.0850, lng: 80.2101, formatted: "Anna Nagar, Chennai, Tamil Nadu" },
  { name: "T. Nagar", city: "Chennai", state: "Tamil Nadu", lat: 13.0418, lng: 80.2341, formatted: "T. Nagar, Chennai, Tamil Nadu" },
  { name: "Perungudi, OMR", city: "Chennai", state: "Tamil Nadu", lat: 12.9654, lng: 80.2461, formatted: "Perungudi, OMR, Chennai, Tamil Nadu" },
  { name: "Manapakkam", city: "Chennai", state: "Tamil Nadu", lat: 13.0169, lng: 80.1764, formatted: "Manapakkam, Chennai, Tamil Nadu" },
  { name: "Aminjikarai", city: "Chennai", state: "Tamil Nadu", lat: 13.0722, lng: 80.2185, formatted: "Aminjikarai, Chennai, Tamil Nadu" },
  { name: "Mogappair", city: "Chennai", state: "Tamil Nadu", lat: 13.0850, lng: 80.1812, formatted: "Mogappair, Chennai, Tamil Nadu" },
  { name: "Mylapore", city: "Chennai", state: "Tamil Nadu", lat: 13.0368, lng: 80.2676, formatted: "Mylapore, Chennai, Tamil Nadu" },
  { name: "Guindy", city: "Chennai", state: "Tamil Nadu", lat: 13.0067, lng: 80.2025, formatted: "Guindy, Chennai, Tamil Nadu" },
  { name: "Tambaram", city: "Chennai", state: "Tamil Nadu", lat: 12.9249, lng: 80.1000, formatted: "Tambaram, Chennai, Tamil Nadu" },
  { name: "Porur", city: "Chennai", state: "Tamil Nadu", lat: 13.0382, lng: 80.1565, formatted: "Porur, Chennai, Tamil Nadu" },
  { name: "Thiruvanmiyur", city: "Chennai", state: "Tamil Nadu", lat: 12.9830, lng: 80.2594, formatted: "Thiruvanmiyur, Chennai, Tamil Nadu" },
  { name: "Besant Nagar", city: "Chennai", state: "Tamil Nadu", lat: 13.0001, lng: 80.2667, formatted: "Besant Nagar, Chennai, Tamil Nadu" },
  { name: "Central Chennai", city: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707, formatted: "Central Chennai, Tamil Nadu" },

  // Bangalore
  { name: "Indiranagar", city: "Bangalore", state: "Karnataka", lat: 12.9784, lng: 77.6408, formatted: "Indiranagar, Bangalore, Karnataka" },
  { name: "Koramangala", city: "Bangalore", state: "Karnataka", lat: 12.9352, lng: 77.6245, formatted: "Koramangala, Bangalore, Karnataka" },
  { name: "Whitefield", city: "Bangalore", state: "Karnataka", lat: 12.9698, lng: 77.7500, formatted: "Whitefield, Bangalore, Karnataka" },
  { name: "HSR Layout", city: "Bangalore", state: "Karnataka", lat: 12.9121, lng: 77.6446, formatted: "HSR Layout, Bangalore, Karnataka" },
  { name: "Jayanagar", city: "Bangalore", state: "Karnataka", lat: 12.9308, lng: 77.5838, formatted: "Jayanagar, Bangalore, Karnataka" },

  // Hyderabad
  { name: "Banjara Hills", city: "Hyderabad", state: "Telangana", lat: 17.4156, lng: 78.4357, formatted: "Banjara Hills, Hyderabad, Telangana" },
  { name: "HITEC City", city: "Hyderabad", state: "Telangana", lat: 17.4435, lng: 78.3772, formatted: "HITEC City, Hyderabad, Telangana" },
  { name: "Gachibowli", city: "Hyderabad", state: "Telangana", lat: 17.4401, lng: 78.3489, formatted: "Gachibowli, Hyderabad, Telangana" },

  // Mumbai
  { name: "Bandra West", city: "Mumbai", state: "Maharashtra", lat: 19.0596, lng: 72.8295, formatted: "Bandra West, Mumbai, Maharashtra" },
  { name: "Andheri", city: "Mumbai", state: "Maharashtra", lat: 19.1136, lng: 72.8697, formatted: "Andheri, Mumbai, Maharashtra" },
  { name: "Powai", city: "Mumbai", state: "Maharashtra", lat: 19.1176, lng: 72.9060, formatted: "Powai, Mumbai, Maharashtra" },

  // Delhi NCR
  { name: "Connaught Place", city: "New Delhi", state: "Delhi", lat: 28.6315, lng: 77.2167, formatted: "Connaught Place, New Delhi" },
  { name: "Saket", city: "New Delhi", state: "Delhi", lat: 28.5244, lng: 77.2066, formatted: "Saket, New Delhi" },
  { name: "Sector 18", city: "Noida", state: "Uttar Pradesh", lat: 28.5355, lng: 77.3910, formatted: "Sector 18, Noida, Uttar Pradesh" }
];

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
    const city = (request.nextUrl.searchParams.get("city") || "").trim().toLowerCase();

    if (!q) {
      const cityMatches = city ? LOCALITIES.filter((l) => l.city.toLowerCase() === city) : LOCALITIES.slice(0, 8);
      return NextResponse.json({ results: cityMatches });
    }

    const matches = LOCALITIES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.formatted.toLowerCase().includes(q)
    );

    // If query didn't match and looks like a generic address, return city default
    if (matches.length === 0) {
      return NextResponse.json({
        results: [
          {
            name: q,
            city: city ? city.charAt(0).toUpperCase() + city.slice(1) : "Chennai",
            state: "Tamil Nadu",
            lat: 13.0827,
            lng: 80.2707,
            formatted: `${q}, Chennai, Tamil Nadu`
          }
        ]
      });
    }

    return NextResponse.json({ results: matches.slice(0, 8) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = (body.query || body.address || body.locality || "").trim().toLowerCase();
    const city = (body.city || "Chennai").trim().toLowerCase();

    const match = LOCALITIES.find(
      (l) =>
        query.includes(l.name.toLowerCase()) ||
        l.name.toLowerCase().includes(query) ||
        query.includes(l.formatted.toLowerCase())
    );

    if (match) {
      return NextResponse.json({
        latitude: match.lat,
        longitude: match.lng,
        formatted_address: match.formatted,
        locality: match.name,
        city: match.city,
        state: match.state
      });
    }

    // Default to city center
    const cityMatch = LOCALITIES.find((l) => l.city.toLowerCase() === city) || LOCALITIES[0];
    return NextResponse.json({
      latitude: cityMatch.lat,
      longitude: cityMatch.lng,
      formatted_address: `${body.locality || query || cityMatch.city}, ${cityMatch.state}`,
      locality: body.locality || cityMatch.name,
      city: cityMatch.city,
      state: cityMatch.state
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
