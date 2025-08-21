import { type INode } from "dag-api";

// Интерфейсы для типизации данных
interface GooglePlacesSearchRequest {
  textQuery: string;
  maxResultCount?: number;
}

interface GooglePlacesLocation {
  latitude: number;
  longitude: number;
}

interface GooglePlacesResult {
  id: string;
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
  primaryType: string;
  location: GooglePlacesLocation;
  websiteUri?: string;
  nationalPhoneNumber?: string;
}

interface GooglePlacesResponse {
  places: GooglePlacesResult[];
}

// Сервис для работы с Google Places API
class GooglePlacesService {
  private apiKey: string;
  private fieldsMask: string;
  private baseUrl = 'https://places.googleapis.com/v1/places:searchText';

  constructor(apiKey: string, fieldsMask: string) {
    this.apiKey = apiKey;
    this.fieldsMask = fieldsMask;
  }

  async search(request: GooglePlacesSearchRequest): Promise<GooglePlacesResponse> {
    const requestBody = {
      textQuery: request.textQuery
    };

    // Добавляем maxResultCount только если он указан
    if (request.maxResultCount) {
      (requestBody as any).maxResultCount = request.maxResultCount;
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': this.fieldsMask
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}

// Основной класс Node
export default class GooglePlacesNode implements INode {
  public scope!: string;
  
  private searchService: GooglePlacesService;

  constructor(
    public name: string,
    apiKey: string,
    fieldsMask: string = 'places.displayName,places.formattedAddress,places.id,places.primaryType,places.location,places.websiteUri,places.nationalPhoneNumber'
  ) {
    this.searchService = new GooglePlacesService(apiKey, fieldsMask);
  }

  async execute(data: { 
    textQuery: string;
    maxResultCount?: number;
  }): Promise<GooglePlacesResponse> {
    try {
      const results = await this.searchService.search({
        textQuery: data.textQuery,
        maxResultCount: data.maxResultCount
      });
      
      return results;
    } catch (error) {
      console.error('Error executing Google Places search:', error);
      throw error;
    }
  }
}

// Пример использования:
/*
const node = new GooglePlacesNode(
  'GooglePlacesSearchNode',
  'YOUR_API_KEY_HERE',
  'places.displayName,places.formattedAddress,places.id,places.primaryType,places.location,places.websiteUri,places.nationalPhoneNumber'
);

const results = await node.execute({
  textQuery: 'CNC machine shop in Texas',
  maxResultCount: 10
});

console.log(results);
*/