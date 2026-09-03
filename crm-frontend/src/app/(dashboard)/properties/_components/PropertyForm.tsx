"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { MobileHeader } from "@/components/layout/mobile-header";
import { apiFetch } from "@/lib/api-fetch";
import { propertiesApi } from "@/lib/properties-api";
export interface Property {
  id: number;
  title: string;
  propertyType: string;
  listingType: string;
  city?: string;
  price?: number;
  status?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  description?: string;
  propertyDetails?: any;
  propertyImages?: any[];
  propertyLocations?: any[];
  [key: string]: any;
}
import {
  ArrowLeft,
  Loader2,
  Save,
  UploadCloud,
  X,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial Space" },
  { value: "coworking", label: "Co-working" },
  { value: "farmland", label: "Farmland" },
  { value: "industrial", label: "Industrial" },
  { value: "individual_portion", label: "Independent House" },
];


const FURNISHING_STATUS_OPTIONS = [
  { value: "BARESHELL", label: "Bareshell" },
  { value: "SEMI FURNISHED", label: "Semi Furnished" },
  { value: "FULLY FURNISHED", label: "Fully Furnished" },
  { value: "UNFURNISHED", label: "Unfurnished" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface City {
  id: number;
  cityName: string;
}

interface Sublocation {
  id: number;
  localityName: string;
  cityId: number;
}

interface FormDataShape {
  cities: City[];
  sublocations: Sublocation[];
  amenities: any[];
}

interface UploadedImage {
  imageUrl: string;
  imageKey: string;
  fileName: string;
  previewUrl: string;
}

export interface PropertyFormProps {
  mode: "create" | "edit";
  initialData?: Property;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const labelClass = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const inputClass = "h-12 rounded-xl bg-muted/30";
const checkboxRowClass = "flex items-center space-x-3 bg-muted/10 border border-border/40 p-4 h-12 rounded-xl transition-colors hover:bg-muted/30";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyForm({ mode, initialData, onSuccess }: PropertyFormProps) {
  const router = useRouter();

  // ---- Meta state ----
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFormData, setIsLoadingFormData] = useState(true);
  const [formData, setFormData] = useState<FormDataShape>({ cities: [], sublocations: [], amenities: [] });

  // Shorthand helpers for initialData
  const d = initialData as any;
  const det = d?.propertyDetails ?? d?.__propertyDetails__ ?? {};
  const loc0 = (d?.propertyLocations ?? d?.__propertyLocations__ ?? [])[0] ?? {};
  const imgs: Array<{ imageUrl: string; imageKey: string; isPrimary: boolean }> =
    d?.propertyImages ?? d?.__propertyImages__ ?? [];

  // ---- Basic Info ----
  const [title, setTitle] = useState(d?.title ?? "");
  const [listingType, setListingType] = useState<"Buy" | "Rent">(
    d?.listingType === "Rent" ? "Rent" : "Buy"
  );
  const [propertyType, setPropertyType] = useState(d?.propertyType ?? "");
  const [status, setStatus] = useState(d?.status ?? "available");
  const [availableFrom, setAvailableFrom] = useState(d?.availableFrom ? new Date(d.availableFrom).toISOString().split('T')[0] : "");
  const [availableUntil, setAvailableUntil] = useState(d?.availableUntil ? new Date(d.availableUntil).toISOString().split('T')[0] : "");
  const [propertyCondition, setPropertyCondition] = useState(d?.propertyCondition ?? "");
  const [ownershipType, setOwnershipType] = useState(d?.ownershipType ?? "");
  const [reraNumber, setReraNumber] = useState(d?.reraNumber ?? "");
  const [projectName, setProjectName] = useState(d?.projectName ?? "");
  const [builderName, setBuilderName] = useState(d?.builderName ?? "");
  const [transactionType, setTransactionType] = useState(d?.transactionType ?? "");
  const [handoverDate, setHandoverDate] = useState(d?.handoverDate ?? "");
  const [saleType, setSaleType] = useState(d?.saleType ?? "");
  const [roadAccess, setRoadAccess] = useState(d?.roadAccess ?? "");
  const [roadName, setRoadName] = useState(d?.roadName ?? "");
  const [tenantOccupied, setTenantOccupied] = useState(d?.tenantOccupied ?? "");

  // ---- Pricing ----
  const [price, setPrice] = useState(d?.price ? String(d.price) : "");
  const [negotiable, setNegotiable] = useState<boolean>(d?.negotiable ?? false);
  const [bookingAmount, setBookingAmount] = useState(d?.bookingAmount ?? "");
  const [brokerageType, setBrokerageType] = useState(d?.brokerageType ?? "no_brokerage");
  const [brokerageValue, setBrokerageValue] = useState(d?.brokerageValue ?? "");
  const [expectedSalePrice, setExpectedSalePrice] = useState(d?.expectedSalePrice ? String(d.expectedSalePrice) : "");
  const [monthlyRent, setMonthlyRent] = useState(d?.monthlyRent ? String(d.monthlyRent) : "");
  const [maintenanceCharges, setMaintenanceCharges] = useState(d?.maintenanceCharges ?? "");
  const [securityDeposit, setSecurityDeposit] = useState(d?.securityDeposit ?? "");
  const [lockInPeriod, setLockInPeriod] = useState(d?.lockInPeriod ?? "");
  const [taxes, setTaxes] = useState(d?.taxes ?? "");
  const [registrationCharge, setRegistrationCharge] = useState(d?.registrationCharge ?? "");
  const [modeOfPayment, setModeOfPayment] = useState(d?.modeOfPayment ?? "");
  const [timeForRegistration, setTimeForRegistration] = useState(d?.timeForRegistration ?? "");

  // ---- Location ----
  const [cityId, setCityId] = useState<string>(d?.cityId ? String(d.cityId) : "");
  const [sublocationId, setSublocationId] = useState<string>(d?.sublocationId ? String(d.sublocationId) : "");
  const [pincode, setPincode] = useState(loc0?.pincode ?? "");
  const [address, setAddress] = useState(loc0?.address ?? "");
  const [latitude, setLatitude] = useState(loc0?.latitude ? String(loc0.latitude) : "");
  const [longitude, setLongitude] = useState(loc0?.longitude ? String(loc0.longitude) : "");

  // ---- Specs / Details ----
  const [bedrooms, setBedrooms] = useState(det?.bedrooms ? String(det.bedrooms) : "");
  const [bathrooms, setBathrooms] = useState(det?.bathrooms ? String(det.bathrooms) : "");
  const [areaSqft, setAreaSqft] = useState(det?.areaSqft ? String(det.areaSqft) : "");
  const [areaUnit, setAreaUnit] = useState(det?.areaUnit ?? "Sq Ft");
  const [furnished, setFurnished] = useState<boolean>(det?.furnished ?? false);
  const [furnishingStatus, setFurnishingStatus] = useState(det?.furnishingStatus ?? "");
  const [propertyFacing, setPropertyFacing] = useState(det?.propertyFacing ?? "");
  const [propertyAge, setPropertyAge] = useState(det?.propertyAge ?? "");
  const [possessionStatus, setPossessionStatus] = useState(det?.possessionStatus ?? "");
  const [openSides, setOpenSides] = useState(det?.openSides ? String(det.openSides) : "");
  const [suitableFor, setSuitableFor] = useState(det?.suitableFor ?? "");
  const [floorNumber, setFloorNumber] = useState(det?.floorNumber ? String(det.floorNumber) : "");
  const [totalFloors, setTotalFloors] = useState(det?.totalFloors ? String(det.totalFloors) : "");
  const [guestParking, setGuestParking] = useState<boolean>(det?.guestParking ?? false);
  const [floorsOccupied, setFloorsOccupied] = useState<string>(det?.floorsOccupied ? det.floorsOccupied.join(", ") : "");
  const [hasRestroom, setHasRestroom] = useState<boolean>(det?.hasRestroom ?? false);

  // ---- Arrays: Amenities, FAQs, Connectivity, Rooms ----
  const [amenityIds, setAmenityIds] = useState<number[]>(d?.amenityIds ?? []);
  const [faqs, setFaqs] = useState<{ question: string; answer: string; section?: string }[]>(d?.faqs ?? []);
  const [connectivity, setConnectivity] = useState<{ icon: string; label: string; detail: string }[]>(loc0?.localityData?.connectivity ?? []);
  const [roomDimensions, setRoomDimensions] = useState<{ name: string; dimensions: string }[]>(det?.roomDimensions ?? []);
  // ---- Apartment / Villa / Individual House ----
  const [unitType, setUnitType] = useState(det?.unitType ?? "");
  const [unitNumber, setUnitNumber] = useState(det?.unitNumber ?? "");
  const [numberOfFlats, setNumberOfFlats] = useState(det?.numberOfFlats ? String(det.numberOfFlats) : "");
  const [towerNos, setTowerNos] = useState(det?.towerNos ? String(det.towerNos) : "");
  const [builtUpArea, setBuiltUpArea] = useState(det?.builtUpArea ? String(det.builtUpArea) : "");
  const [carpetArea, setCarpetArea] = useState(det?.carpetArea ? String(det.carpetArea) : "");
  const [superBuiltUpArea, setSuperBuiltUpArea] = useState(det?.superBuiltUpArea ? String(det.superBuiltUpArea) : "");
  const [udsArea, setUdsArea] = useState(det?.udsArea ? String(det.udsArea) : "");
  const [plotArea, setPlotArea] = useState(det?.plotArea ? String(det.plotArea) : "");
  const [balconies, setBalconies] = useState(det?.balconies ? String(det.balconies) : "");
  const [poojaRoom, setPoojaRoom] = useState<boolean>(det?.poojaRoom ?? false);
  const [studyRoom, setStudyRoom] = useState<boolean>(det?.studyRoom ?? false);
  const [architecturalStyle, setArchitecturalStyle] = useState(det?.architecturalStyle ?? "");
  const [availablePortion, setAvailablePortion] = useState(det?.availablePortion ?? "");
  const [amenities, setAmenities] = useState(det?.amenities ?? "");
  const [outdoorSpaces, setOutdoorSpaces] = useState(det?.outdoorSpaces ?? "");
  const [utilitiesProvided, setUtilitiesProvided] = useState(det?.utilitiesProvided ?? "");
  const [neighborhoodHighlights, setNeighborhoodHighlights] = useState(det?.neighborhoodHighlights ?? "");
  const [communityFacilities, setCommunityFacilities] = useState(det?.communityFacilities ?? "");

  // ---- Plot / Farmland ----
  const [plotSizeCents, setPlotSizeCents] = useState(det?.plotSizeCents ? String(det.plotSizeCents) : "");
  const [plotNos, setPlotNos] = useState(det?.plotNos ? String(det.plotNos) : "");
  const [zoning, setZoning] = useState(det?.zoning ?? "");
  const [plotType, setPlotType] = useState(det?.plotType ?? "");
  const [sfNumber, setSfNumber] = useState(det?.sfNumber ?? "");
  const [landType, setLandType] = useState(det?.landType ?? "");
  const [topography, setTopography] = useState(det?.topography ?? "");
  const [soilType, setSoilType] = useState(det?.soilType ?? "");
  const [irrigation, setIrrigation] = useState(det?.irrigation ?? "");
  const [fencing, setFencing] = useState(det?.fencing ?? "");
  const [cropSuitability, setCropSuitability] = useState(det?.cropSuitability ?? "");
  const [existingPlantation, setExistingPlantation] = useState(det?.existingPlantation ?? "");
  const [boreWell, setBoreWell] = useState<boolean>(det?.boreWell ?? false);
  const [storageTank, setStorageTank] = useState<boolean>(det?.storageTank ?? false);
  const [waterSources, setWaterSources] = useState(det?.waterSources ?? "");
  const [boundaryWall, setBoundaryWall] = useState<boolean>(det?.boundaryWall ?? false);
  const [plotLength, setPlotLength] = useState(det?.plotLength ? String(det.plotLength) : "");
  const [plotWidth, setPlotWidth] = useState(det?.plotWidth ? String(det.plotWidth) : "");

  // ---- Commercial ----
  const [propertyUse, setPropertyUse] = useState(det?.propertyUse ?? "");
  const [noOfLifts, setNoOfLifts] = useState(det?.noOfLifts ? String(det.noOfLifts) : "");
  const [dimension, setDimension] = useState(det?.dimension ?? "");
  const [frontage, setFrontage] = useState(det?.frontage ?? "");
  const [carParking, setCarParking] = useState(det?.carParking ? String(det.carParking) : "");
  const [bikeParking, setBikeParking] = useState(det?.bikeParking ? String(det.bikeParking) : "");
  const [outsideParking, setOutsideParking] = useState<boolean>(det?.outsideParking ?? false);
  const [visitorsParking, setVisitorsParking] = useState(det?.visitorsParking ?? "");
  const [fireSafety, setFireSafety] = useState<boolean>(det?.fireSafety ?? false);
  const [ceilingHeightFt, setCeilingHeightFt] = useState(det?.ceilingHeightFt ? String(det.ceilingHeightFt) : "");
  const [electricityConnection, setElectricityConnection] = useState(det?.electricityConnection ?? "");
  const [powerBackup, setPowerBackup] = useState<boolean>(det?.powerBackup ?? false);
  const [hasCentralAc, setHasCentralAc] = useState<boolean>(det?.hasCentralAc ?? false);
  const [hasPantry, setHasPantry] = useState<boolean>(det?.hasPantry ?? false);
  const [conferenceRoom, setConferenceRoom] = useState(det?.conferenceRoom ? String(det.conferenceRoom) : "");
  const [seater, setSeater] = useState(det?.seater ? String(det.seater) : "");
  const [tenantMix, setTenantMix] = useState(det?.tenantMix ?? "");
  const [commercialAmenities, setCommercialAmenities] = useState(det?.amenities ?? "");

  // ---- Coworking ----
  const [availableWorkstations, setAvailableWorkstations] = useState(det?.availableWorkstations ? String(det.availableWorkstations) : "");
  const [privateCabins, setPrivateCabins] = useState(det?.privateCabins ? String(det.privateCabins) : "");
  const [meetingRooms, setMeetingRooms] = useState(det?.meetingRooms ? String(det.meetingRooms) : "");
  const [minSeats, setMinSeats] = useState(det?.minSeats ? String(det.minSeats) : "");
  const [rentPerSeat, setRentPerSeat] = useState(det?.rentPerSeat ? String(det.rentPerSeat) : "");
  const [advanceRent, setAdvanceRent] = useState(det?.advanceRent ? String(det.advanceRent) : "");
  const [leaseTerm, setLeaseTerm] = useState(det?.leaseTerm ?? "");
  const [incrementalRent, setIncrementalRent] = useState(det?.incrementalRent ?? "");
  const [electricityCharges, setElectricityCharges] = useState(det?.electricityCharges ?? "");
  const [highSpeedWifi, setHighSpeedWifi] = useState<boolean>(det?.highSpeedWifi ?? false);
  const [airConditioning, setAirConditioning] = useState<boolean>(det?.airConditioning ?? false);
  const [cctvSurveillance, setCctvSurveillance] = useState<boolean>(det?.cctvSurveillance ?? false);
  const [coworkingPowerBackup, setCoworkingPowerBackup] = useState<boolean>(det?.powerBackup ?? false);
  const [elevatorAccess, setElevatorAccess] = useState<boolean>(det?.elevatorAccess ?? false);
  const [coworkingHasPantry, setCoworkingHasPantry] = useState<boolean>(det?.hasPantry ?? false);
  const [securityStaff, setSecurityStaff] = useState<boolean>(det?.securityStaff ?? false);
  const [furnitureProvided, setFurnitureProvided] = useState(det?.furnitureProvided ?? "");
  const [accessibility, setAccessibility] = useState(det?.accessibility ?? "");

  // ---- Industrial ----
  const [buildingType, setBuildingType] = useState(det?.buildingType ?? "");
  const [industrialPropertyUse, setIndustrialPropertyUse] = useState(det?.propertyUse ?? "");
  const [coveredArea, setCoveredArea] = useState(det?.coveredArea ? String(det.coveredArea) : "");
  const [openArea, setOpenArea] = useState(det?.openArea ? String(det.openArea) : "");
  const [industrialCeilingHeight, setIndustrialCeilingHeight] = useState(det?.ceilingHeightFt ? String(det.ceilingHeightFt) : "");
  const [floorType, setFloorType] = useState(det?.floorType ?? "");
  const [numberOfBays, setNumberOfBays] = useState(det?.numberOfBays ? String(det.numberOfBays) : "");
  const [numberOfCabins, setNumberOfCabins] = useState(det?.numberOfCabins ? String(det.numberOfCabins) : "");
  const [powerSupplyHp, setPowerSupplyHp] = useState(det?.powerSupplyHp ? String(det.powerSupplyHp) : "");
  const [waterSupply, setWaterSupply] = useState(det?.waterSupply ?? "");
  const [truckParking, setTruckParking] = useState(det?.truckParking ? String(det.truckParking) : "");
  const [industrialCarParking, setIndustrialCarParking] = useState(det?.carParking ? String(det.carParking) : "");
  const [industrialBikeParking, setIndustrialBikeParking] = useState(det?.bikeParking ? String(det.bikeParking) : "");
  const [industrialFireSafety, setIndustrialFireSafety] = useState<boolean>(det?.fireSafety ?? false);
  const [loadingBays, setLoadingBays] = useState(det?.loadingBays ? String(det.loadingBays) : "");
  const [warehouseRacks, setWarehouseRacks] = useState(det?.warehouseRacks ? String(det.warehouseRacks) : "");
  const [truckTrailerAccess, setTruckTrailerAccess] = useState<boolean>(det?.truckTrailerAccess ?? false);
  const [craneAvailable, setCraneAvailable] = useState<boolean>(det?.craneAvailable ?? false);
  const [workerFacilities, setWorkerFacilities] = useState(det?.workerFacilities ?? "");
  const [nearestHighway, setNearestHighway] = useState(det?.nearestHighway ?? "");
  const [nearestRailway, setNearestRailway] = useState(det?.nearestRailway ?? "");
  const [nearestPort, setNearestPort] = useState(det?.nearestPort ?? "");
  const [nearestAirport, setNearestAirport] = useState(det?.nearestAirport ?? "");
  const [labourAvailability, setLabourAvailability] = useState(det?.labourAvailability ?? "");
  const [industrialPowerBackup, setIndustrialPowerBackup] = useState<boolean>(det?.powerBackup ?? false);
  const [heavyVehicleAccess, setHeavyVehicleAccess] = useState<boolean>(det?.heavyVehicleAccess ?? false);

  // ---- Owner ----
  const [ownerName, setOwnerName] = useState(d?.ownerName ?? "");
  const [ownerPhone, setOwnerPhone] = useState(d?.ownerPhone ?? "");
  const [ownerEmail, setOwnerEmail] = useState(d?.ownerEmail ?? "");

  // ---- Agent ----
  const [agentName, setAgentName] = useState(d?.agentName ?? "");
  const [agencyName, setAgencyName] = useState(d?.agencyName ?? "");
  const [commissionTerms, setCommissionTerms] = useState(d?.commissionTerms ?? "");
  const [alternateName, setAlternateName] = useState(d?.alternateName ?? "");
  const [alternatePhone, setAlternatePhone] = useState(d?.alternatePhone ?? "");
  const [alternateEmail, setAlternateEmail] = useState(d?.alternateEmail ?? "");

  // ---- Documents & Verification ----
  const [ownershipTitleVerified, setOwnershipTitleVerified] = useState(d?.ownershipTitleVerified ?? "");
  const [encumbranceCertificate, setEncumbranceCertificate] = useState(d?.encumbranceCertificate ?? "");
  const [rentalAgreementDraft, setRentalAgreementDraft] = useState(d?.rentalAgreementDraft ?? "");
  const [tslrFmb, setTslrFmb] = useState(d?.tslrFmb ?? "");
  const [taxReceipt, setTaxReceipt] = useState(d?.taxReceipt ?? "");
  const [ebReceipt, setEbReceipt] = useState(d?.ebReceipt ?? "");
  const [pattaChitta, setPattaChitta] = useState(d?.pattaChitta ?? "");
  const [approvals, setApprovals] = useState(d?.approvals ?? "");
  const [financeFacing, setFinanceFacing] = useState(d?.financeFacing ?? "");
  const [hypothecation, setHypothecation] = useState(d?.hypothecation ?? "");
  const [deviation, setDeviation] = useState(d?.deviation ?? "");

  // ---- Market Analysis ----
  const [comparativePrice, setComparativePrice] = useState(d?.comparativePrice ?? "");
  const [rentalYield, setRentalYield] = useState(d?.rentalYield ?? "");
  const [marketPrice, setMarketPrice] = useState(d?.marketPrice ?? "");
  const [demandArea, setDemandArea] = useState(d?.demandArea ?? "");
  const [remark, setRemark] = useState(d?.remark ?? "");

  // ---- Description ----
  const [description, setDescription] = useState(d?.description ?? "");

  // ---- Documents (direct file upload, typed slots) ----
  interface DocSlot {
    fileKey: string;
    fileName: string;
    fileUrl?: string;
  }
  const DOC_SLOTS = [
    { key: "brochure", label: "Brochure" },
    { key: "floor_plan", label: "Floor Plan" },
    { key: "legal_document", label: "Legal Document" },
    { key: "ownership_proof", label: "Ownership Proof" },
    { key: "approval_certificate", label: "Approval Certificate" },
    { key: "tax_receipt", label: "Tax Receipt" },
  ];
  const initialDocs: Record<string, DocSlot | null> = {};
  for (const slot of DOC_SLOTS) {
    const found = (d?.documents ?? []).find((x: any) => x.documentType === slot.key);
    initialDocs[slot.key] = found
      ? { fileKey: found.fileKey ?? "", fileName: found.fileName ?? "", fileUrl: found.fileUrl }
      : null;
  }
  const [documents, setDocuments] = useState<Record<string, DocSlot | null>>(initialDocs);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDocFile = async (slotKey: string, file: File) => {
    setUploadingDoc(slotKey);
    try {
      const result = await propertiesApi.uploadDocs([file]);
      const item = result?.data?.[0];
      if (!result?.success || !item?.fileKey) throw new Error("Upload failed");
      setDocuments((prev) => ({
        ...prev,
        [slotKey]: { fileKey: item.fileKey, fileName: item.fileName },
      }));
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setUploadingDoc(null);
    }
  };

  // ---- Image state: existing (from DB) + newly uploaded ----
  const [existingImages, setExistingImages] = useState<Array<{ imageUrl: string; imageKey: string; isPrimary: boolean }>>(imgs);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadTotalCount, setUploadTotalCount] = useState(0);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // ---- Load form data (cities & sublocations) ----
  useEffect(() => {
    setIsLoadingFormData(true);
    propertiesApi
      .formData()
      .then((data: any) => {
        if (data) {
        setFormData({
          cities: data.cities ?? [],
          sublocations: data.sublocations ?? [],
          amenities: data.amenities ?? [],
        });
        }
      })
      .catch(() => {
        toast.error("Failed to load form data.");
      })
      .finally(() => setIsLoadingFormData(false));
  }, []);

  // ---- Filtered sublocations based on selected city ----
  const filteredSublocations = cityId
    ? formData.sublocations.filter((s) => String(s.cityId) === cityId)
    : [];

  // ---- Handle city change (reset locality) ----
  const handleCityChange = (val: string) => {
    setCityId(val);
    setSublocationId("");
  };

  // ---- Image upload logic ----
  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    // Reset the input so the same files can be re-selected if removed
    if (imgInputRef.current) imgInputRef.current.value = "";

    setUploadTotalCount(files.length);
    setUploadingCount(files.length);

    const newImages: UploadedImage[] = [];

    try {
      // Single direct upload: files in, R2 keys out — no URLs involved
      const result = await propertiesApi.uploadImages(files);
      const uploaded = result?.data ?? [];
      if (!result?.success || uploaded.length === 0) throw new Error("Upload failed");
      const previews = new Map(files.map((f) => [f.name, URL.createObjectURL(f)]));
      for (const item of uploaded) {
        newImages.push({
          imageUrl: item.imageKey,
          imageKey: item.imageKey,
          fileName: item.fileName,
          previewUrl: previews.get(item.fileName) ?? "",
        });
      }
      setUploadingCount(0);
    } catch {
      toast.error("Failed to upload images. Please try again.");
      setUploadingCount(0);
    }

    setUploadedImages((prev) => [...prev, ...newImages]);
    setUploadTotalCount(0);
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].previewUrl);
      next.splice(index, 1);
      return next;
    });
  };

  // ---- Validation ----
  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    if (!listingType) return "Listing type is required.";
    if (!propertyType) return "Property type is required.";
    if (!price || isNaN(Number(price))) return "A valid price is required.";
    if (!cityId) return "City is required.";
    if (!sublocationId) return "Locality is required.";
    return null;
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        listingType: listingType === "Buy" ? "Sell" : "Rent",
        propertyType,
        price: Number(price),
        negotiable,
        status,
        availableFrom: availableFrom || undefined,
        availableUntil: availableUntil || undefined,
        cityId: cityId ? Number(cityId) : undefined,
        sublocationId: sublocationId ? Number(sublocationId) : undefined,

        // Basic Info extras
        propertyCondition: propertyCondition.trim() || undefined,
        ownershipType: ownershipType.trim() || undefined,
        reraNumber: reraNumber.trim() || "Not Applicable",
        projectName: projectName.trim() || undefined,
        builderName: builderName.trim() || undefined,
        transactionType: transactionType.trim() || undefined,
        handoverDate: handoverDate.trim() || undefined,
        saleType: saleType.trim() || undefined,
        roadAccess: roadAccess.trim() || undefined,
        roadName: roadName.trim() || undefined,
        tenantOccupied: tenantOccupied.trim() || undefined,

        // Pricing
        bookingAmount: bookingAmount.trim() || undefined,
        brokerageType: brokerageType.trim() || undefined,
        brokerageValue: brokerageValue.trim() || undefined,
        expectedSalePrice: expectedSalePrice ? Number(expectedSalePrice) : undefined,
        monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
        maintenanceCharges: maintenanceCharges.trim() || undefined,
        securityDeposit: securityDeposit.trim() || undefined,
        lockInPeriod: lockInPeriod.trim() || undefined,
        taxes: taxes.trim() || undefined,
        registrationCharge: registrationCharge.trim() || undefined,
        modeOfPayment: modeOfPayment.trim() || undefined,
        timeForRegistration: timeForRegistration.trim() || undefined,

        // Location
        locationData:
          address.trim() || latitude.trim() || longitude.trim() || pincode.trim() || connectivity.length > 0
            ? {
                address: address.trim() || undefined,
                pincode: pincode.trim() || undefined,
                latitude: latitude.trim() ? parseFloat(latitude) : undefined,
                longitude: longitude.trim() ? parseFloat(longitude) : undefined,
                localityData: connectivity.length > 0 ? { connectivity: connectivity.filter((c) => c.label || c.detail) } : undefined,
              }
            : undefined,

        // Specs (common)
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        areaSqft: areaSqft ? Number(areaSqft) : undefined,
        areaUnit,
        furnished,
        furnishingStatus: furnishingStatus.trim() || undefined,
        propertyFacing: propertyFacing.trim() || undefined,
        propertyAge: propertyAge.trim() || undefined,
        possessionStatus: possessionStatus.trim() || undefined,
        openSides: openSides ? Number(openSides) : undefined,
        suitableFor: suitableFor.trim() || undefined,
        floorNumber: floorNumber.trim() || undefined,
        totalFloors: totalFloors ? Number(totalFloors) : undefined,
        guestParking,
        floorsOccupied: floorsOccupied.trim() ? floorsOccupied.split(",").map((s) => s.trim()) : undefined,
        hasRestroom,
        roomDimensions: roomDimensions.filter((r) => r.name || r.dimensions).length > 0 ? roomDimensions : undefined,

        // Arrays
        amenityIds: amenityIds.length > 0 ? amenityIds : undefined,
        faqs: faqs.filter((f) => f.question && f.answer).length > 0 ? faqs : undefined,
        
        // Owner
        ownerName: ownerName.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        ownerEmail: ownerEmail.trim() || undefined,

        // Agent
        agentName: agentName.trim() || undefined,
        agencyName: agencyName.trim() || undefined,
        commissionTerms: commissionTerms.trim() || undefined,
        alternateName: alternateName.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        alternateEmail: alternateEmail.trim() || undefined,

        // Documents
        ownershipTitleVerified: ownershipTitleVerified.trim() || undefined,
        encumbranceCertificate: encumbranceCertificate.trim() || undefined,
        rentalAgreementDraft: rentalAgreementDraft.trim() || undefined,
        tslrFmb: tslrFmb.trim() || undefined,
        taxReceipt: taxReceipt.trim() || undefined,
        ebReceipt: ebReceipt.trim() || undefined,
        pattaChitta: pattaChitta.trim() || undefined,
        approvals: approvals.trim() || undefined,
        financeFacing: financeFacing.trim() || undefined,
        hypothecation: hypothecation.trim() || undefined,
        deviation: deviation.trim() || undefined,

        // Market Analysis
        comparativePrice: comparativePrice.trim() || undefined,
        rentalYield: rentalYield.trim() || undefined,
        marketPrice: marketPrice.trim() || undefined,
        demandArea: demandArea.trim() || undefined,
        remark: remark.trim() || undefined,

        // Description
        description: description.trim() || undefined,

        // Images — merge kept existing images with newly uploaded ones
        imageUrls: [
          ...existingImages.map((img, idx) => ({
            imageUrl: img.imageUrl,
            imageKey: img.imageKey ?? "",
            isPrimary: idx === 0 && uploadedImages.length === 0 ? img.isPrimary : false,
          })),
          ...uploadedImages.map((img, idx) => ({
            imageUrl: img.imageKey || img.imageUrl,
            imageKey: img.imageKey || "",
            isPrimary: existingImages.length === 0 && idx === 0,
          })),
        ].map((img, idx) => ({ ...img, isPrimary: idx === 0 })),

        // Documents — typed slots, kept entries only
        documents: DOC_SLOTS.flatMap(({ key, label }) => {
          const doc = documents[key];
          if (!doc?.fileKey) return [];
          return [{
            fileKey: doc.fileKey,
            fileName: doc.fileName,
            documentType: key,
            title: label,
          }];
        }),
      };

      // Apartment / Villa / Individual Portion fields
      if (["apartment", "villa", "individual_portion"].includes(propertyType)) {
        Object.assign(payload, {
          unitType: unitType.trim() || undefined,
          unitNumber: unitNumber.trim() || undefined,
          numberOfFlats: numberOfFlats ? Number(numberOfFlats) : undefined,
          towerNos: towerNos ? Number(towerNos) : undefined,
          builtUpArea: builtUpArea ? Number(builtUpArea) : undefined,
          carpetArea: carpetArea ? Number(carpetArea) : undefined,
          superBuiltUpArea: superBuiltUpArea ? Number(superBuiltUpArea) : undefined,
          udsArea: udsArea ? Number(udsArea) : undefined,
          plotArea: plotArea.trim() || undefined,
          balconies: balconies ? Number(balconies) : undefined,
          poojaRoom,
          studyRoom,
          architecturalStyle: architecturalStyle.trim() || undefined,
          availablePortion: availablePortion.trim() || undefined,
          amenities: amenities.trim() || undefined,
          outdoorSpaces: outdoorSpaces.trim() || undefined,
          utilitiesProvided: utilitiesProvided.trim() || undefined,
          neighborhoodHighlights: neighborhoodHighlights.trim() || undefined,
          communityFacilities: communityFacilities.trim() || undefined,
        });
      }

      // Plot / Farmland fields
      if (["plot", "farmland"].includes(propertyType)) {
        Object.assign(payload, {
          plotSizeCents: plotSizeCents ? Number(plotSizeCents) : undefined,
          plotNos: plotNos ? Number(plotNos) : undefined,
          zoning: zoning.trim() || undefined,
          plotType: plotType.trim() || undefined,
          sfNumber: sfNumber.trim() || undefined,
          landType: landType.trim() || undefined,
          topography: topography.trim() || undefined,
          soilType: soilType.trim() || undefined,
          irrigation: irrigation.trim() || undefined,
          fencing: fencing.trim() || undefined,
          waterSources: waterSources.trim() || undefined,
          boundaryWall,
          plotLength: plotLength ? Number(plotLength) : undefined,
          plotWidth: plotWidth ? Number(plotWidth) : undefined,
        });

        if (propertyType === "farmland") {
          Object.assign(payload, {
            cropSuitability: cropSuitability.trim() || undefined,
            existingPlantation: existingPlantation.trim() || undefined,
            boreWell,
            storageTank,
          });
        }
      }

      // Commercial fields
      if (propertyType === "commercial") {
        Object.assign(payload, {
          propertyUse: propertyUse.trim() || undefined,
          noOfLifts: noOfLifts ? Number(noOfLifts) : undefined,
          dimension: dimension.trim() || undefined,
          frontage: frontage.trim() || undefined,
          carParking: carParking ? Number(carParking) : undefined,
          bikeParking: bikeParking ? Number(bikeParking) : undefined,
          outsideParking,
          visitorsParking: visitorsParking.trim() || undefined,
          fireSafety,
          ceilingHeightFt: ceilingHeightFt ? Number(ceilingHeightFt) : undefined,
          electricityConnection: electricityConnection.trim() || undefined,
          powerBackup,
          hasCentralAc,
          hasPantry,
          conferenceRoom: conferenceRoom ? Number(conferenceRoom) : undefined,
          seater: seater ? Number(seater) : undefined,
          tenantMix: tenantMix.trim() || undefined,
          amenities: commercialAmenities.trim() || undefined,
        });
      }

      // Coworking fields
      if (propertyType === "coworking") {
        Object.assign(payload, {
          availableWorkstations: availableWorkstations ? Number(availableWorkstations) : undefined,
          privateCabins: privateCabins ? Number(privateCabins) : undefined,
          meetingRooms: meetingRooms ? Number(meetingRooms) : undefined,
          minSeats: minSeats ? Number(minSeats) : undefined,
          rentPerSeat: rentPerSeat ? Number(rentPerSeat) : undefined,
          advanceRent: advanceRent ? Number(advanceRent) : undefined,
          leaseTerm: leaseTerm.trim() || undefined,
          incrementalRent: incrementalRent.trim() || undefined,
          electricityCharges: electricityCharges.trim() || undefined,
          highSpeedWifi,
          airConditioning,
          cctvSurveillance,
          powerBackup: coworkingPowerBackup,
          elevatorAccess,
          hasPantry: coworkingHasPantry,
          securityStaff,
          furnitureProvided: furnitureProvided.trim() || undefined,
          accessibility: accessibility.trim() || undefined,
        });
      }

      // Industrial fields
      if (propertyType === "industrial") {
        Object.assign(payload, {
          buildingType: buildingType.trim() || undefined,
          propertyUse: industrialPropertyUse.trim() || undefined,
          coveredArea: coveredArea ? Number(coveredArea) : undefined,
          openArea: openArea ? Number(openArea) : undefined,
          ceilingHeightFt: industrialCeilingHeight ? Number(industrialCeilingHeight) : undefined,
          floorType: floorType.trim() || undefined,
          numberOfBays: numberOfBays ? Number(numberOfBays) : undefined,
          numberOfCabins: numberOfCabins ? Number(numberOfCabins) : undefined,
          powerSupplyHp: powerSupplyHp ? Number(powerSupplyHp) : undefined,
          waterSupply: waterSupply.trim() || undefined,
          truckParking: truckParking ? Number(truckParking) : undefined,
          carParking: industrialCarParking ? Number(industrialCarParking) : undefined,
          bikeParking: industrialBikeParking ? Number(industrialBikeParking) : undefined,
          fireSafety: industrialFireSafety,
          loadingBays: loadingBays ? Number(loadingBays) : undefined,
          warehouseRacks: warehouseRacks ? Number(warehouseRacks) : undefined,
          truckTrailerAccess,
          craneAvailable,
          workerFacilities: workerFacilities.trim() || undefined,
          nearestHighway: nearestHighway.trim() || undefined,
          nearestRailway: nearestRailway.trim() || undefined,
          nearestPort: nearestPort.trim() || undefined,
          nearestAirport: nearestAirport.trim() || undefined,
          labourAvailability: labourAvailability.trim() || undefined,
          powerBackup: industrialPowerBackup,
          heavyVehicleAccess,
        });
      }

      // Remove undefined fields
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      let result: any;
      if (mode === "create") {
        result = await propertiesApi.create(payload);
      } else {
        result = await propertiesApi.update(initialData!.id, payload);
      }

      if (result && result.success === false) {
        toast.error(result.message ?? `Failed to ${mode} property.`);
        return;
      }

      toast.success(`Property ${mode === "create" ? "created" : "updated"} successfully!`);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/properties");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Render ----
  if (isLoadingFormData) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#0052FF]" />
          <p className="text-muted-foreground font-medium">Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2.5 md:px-0 mt-2 md:mt-0 mb-20 md:mb-0">
      <MobileHeader title={mode === "create" ? "Add Property" : "Edit Property"} showBack />

      {/* Desktop header */}
      <div className="hidden md:flex items-center gap-4 min-h-[48px]">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => router.push("/properties")}
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "create" ? "Add New Property" : "Edit Property"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "create"
              ? "Enter the details for the new property."
              : "Update the details for this property."}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
          }
        }}
        className="space-y-6"
      >
        {/* ---- Basic Info ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Title */}
            <div className="space-y-2 lg:col-span-3">
              <label className={labelClass}>Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 3 BHK Apartment in Anna Nagar"
                required
                className={inputClass}
              />
            </div>

            {/* Listing Type */}
            <div className="space-y-2">
              <label className={labelClass}>Listing Type *</label>
              <div className="flex gap-2">
                {(["Buy", "Rent"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setListingType(type)}
                    className={`flex-1 h-12 rounded-xl border font-semibold text-sm transition-all ${
                      listingType === type
                        ? "bg-[#0052FF] text-white border-[#0052FF] shadow-md"
                        : "bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted/60"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className={labelClass}>Property Type *</label>
              <FormSelect
                name="propertyType"
                placeholder="Select Type"
                options={PROPERTY_TYPE_OPTIONS}
                value={propertyType || null}
                onValueChange={setPropertyType}
                required
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className={labelClass}>Status</label>
              <FormSelect
                name="status"
                placeholder="Select Status"
                options={[
                  { label: "Available", value: "available" },
                  { label: "Sold", value: "sold" },
                  { label: "Rented", value: "rented" },
                  { label: "Unavailable", value: "unavailable" },
                ]}
                value={status || null}
                onValueChange={setStatus}
              />
            </div>

            {/* Available From */}
            <div className="space-y-2">
              <label className={labelClass}>Available From</label>
              <Input
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Available Until */}
            <div className="space-y-2">
              <label className={labelClass}>Available Until</label>
              <Input
                type="date"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* RERA Number */}
            <div className="space-y-2 lg:col-span-3">
              <label className={labelClass}>RERA Number *</label>
              <div className="flex gap-4">
                <Input
                  value={reraNumber}
                  onChange={(e) => setReraNumber(e.target.value)}
                  placeholder="e.g. TN/29/Building/0001/2021"
                  required
                  disabled={reraNumber === "Not Applicable"}
                  className={inputClass}
                />
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer shrink-0">
                  <Checkbox
                    checked={reraNumber === "Not Applicable"}
                    onCheckedChange={(checked) => setReraNumber(checked ? "Not Applicable" : "")}
                  />
                  Not Applicable
                </label>
              </div>
            </div>

            {/* Property Condition */}
            <div className="space-y-2">
              <label className={labelClass}>Property Condition</label>
              <FormSelect
                name="propertyCondition"
                placeholder="Select Condition"
                options={[
                  { label: "New", value: "New" },
                  { label: "Under Construction", value: "Under Construction" },
                  { label: "Resale", value: "Resale" }
                ]}
                value={propertyCondition || null}
                onValueChange={setPropertyCondition}
              />
            </div>

            {/* Ownership Type */}
            <div className="space-y-2">
              <label className={labelClass}>Ownership Type</label>
              <FormSelect
                name="ownershipType"
                placeholder="Select Ownership"
                options={[
                  { label: "Freehold", value: "Freehold" },
                  { label: "Leasehold", value: "Leasehold" }
                ]}
                value={ownershipType || null}
                onValueChange={setOwnershipType}
              />
            </div>

            {/* Builder Name */}
            <div className="space-y-2">
              <label className={labelClass}>Builder Name</label>
              <Input
                value={builderName}
                onChange={(e) => setBuilderName(e.target.value)}
                placeholder="e.g. Sobha Developers"
                className={inputClass}
              />
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <label className={labelClass}>Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Sobha City"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass}>Transaction Type</label>
              <Input
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                placeholder="e.g. RESALE TENANT OCCUPIED"
                className={inputClass}
              />
            </div>

            {/* Handover Date */}
            <div className="space-y-2">
              <label className={labelClass}>Handover Date</label>
              <Input
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                placeholder="e.g. Jan 2025"
                className={inputClass}
              />
            </div>

            {/* Sale Type */}
            <div className="space-y-2">
              <label className={labelClass}>Sale Type (Full/Partial)</label>
              <Input
                value={saleType}
                onChange={(e) => setSaleType(e.target.value)}
                placeholder="e.g. Full"
                className={inputClass}
              />
            </div>

            {/* Road Access */}
            <div className="space-y-2">
              <label className={labelClass}>Road Access</label>
              <Input
                value={roadAccess}
                onChange={(e) => setRoadAccess(e.target.value)}
                placeholder="e.g. 30 FT"
                className={inputClass}
              />
            </div>

            {/* Road Name */}
            <div className="space-y-2">
              <label className={labelClass}>Road Name</label>
              <Input
                value={roadName}
                onChange={(e) => setRoadName(e.target.value)}
                placeholder="Road Name"
                className={inputClass}
              />
            </div>

            {/* Tenant Occupied */}
            <div className="space-y-2">
              <label className={labelClass}>Tenant Occupied</label>
              <Input
                value={tenantOccupied}
                onChange={(e) => setTenantOccupied(e.target.value)}
                placeholder="e.g. Yes / No"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Pricing ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Price */}
            <div className="space-y-2">
              <label className={labelClass}>Price *</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 5000000"
                required
                min={0}
                className={inputClass}
              />
            </div>

            {/* Negotiable */}
            <div className="space-y-2">
              <label className={labelClass}>Negotiable</label>
              <div className={checkboxRowClass}>
                <Checkbox
                  id="negotiable"
                  checked={negotiable}
                  onCheckedChange={(checked) => setNegotiable(!!checked)}
                />
                <label htmlFor="negotiable" className="text-sm font-semibold cursor-pointer flex-1">
                  Price is negotiable
                </label>
              </div>
            </div>

            {/* Booking Amount */}
            <div className="space-y-2">
              <label className={labelClass}>{listingType === "Rent" ? "Security Deposit" : "Booking Amount"}</label>
              <Input
                type="number"
                value={bookingAmount}
                onChange={(e) => setBookingAmount(e.target.value)}
                placeholder="e.g. 50000"
                min={0}
                className={inputClass}
              />
            </div>

            {/* Brokerage Type */}
            <div className="space-y-2">
              <label className={labelClass}>Brokerage Type</label>
              <FormSelect
                name="brokerageType"
                placeholder="Select Brokerage"
                options={[
                  { label: "No Brokerage", value: "no_brokerage" },
                  { label: listingType === "Rent" ? "Days" : "Percentage", value: listingType === "Rent" ? "days" : "percentage" },
                  { label: "Fixed", value: "fixed" }
                ]}
                value={brokerageType || null}
                onValueChange={setBrokerageType}
              />
            </div>

            {/* Brokerage Value */}
            {brokerageType !== "no_brokerage" && (
              <div className="space-y-2">
                <label className={labelClass}>
                  Brokerage {brokerageType === "percentage" ? "Percentage (%)" : brokerageType === "days" ? "Days" : "Amount (₹)"}
                </label>
                <Input
                  type="number"
                  value={brokerageValue}
                  onChange={(e) => setBrokerageValue(e.target.value)}
                  placeholder={brokerageType === "percentage" ? "e.g. 2" : "e.g. 15"}
                  min={0}
                  className={inputClass}
                />
              </div>
            )}

            {/* Expected Sale Price */}
            <div className="space-y-2">
              <label className={labelClass}>Expected Sale Price</label>
              <Input
                type="number"
                value={expectedSalePrice}
                onChange={(e) => setExpectedSalePrice(e.target.value)}
                placeholder="e.g. 5500000"
                min={0}
                className={inputClass}
              />
            </div>

            {/* Monthly Rent */}
            <div className="space-y-2">
              <label className={labelClass}>Monthly Rent</label>
              <Input
                type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                placeholder="e.g. 25000"
                min={0}
                className={inputClass}
              />
            </div>

            {/* Maintenance Charges */}
            <div className="space-y-2">
              <label className={labelClass}>Maintenance Charges</label>
              <Input
                value={maintenanceCharges}
                onChange={(e) => setMaintenanceCharges(e.target.value)}
                placeholder="e.g. 2000/month"
                className={inputClass}
              />
            </div>

            {/* Security Deposit */}
            <div className="space-y-2">
              <label className={labelClass}>Security Deposit</label>
              <Input
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)}
                placeholder="e.g. 3 months"
                className={inputClass}
              />
            </div>

            {/* Lock In Period */}
            <div className="space-y-2">
              <label className={labelClass}>Lock In Period</label>
              <Input
                value={lockInPeriod}
                onChange={(e) => setLockInPeriod(e.target.value)}
                placeholder="e.g. 11 months"
                className={inputClass}
              />
            </div>

            {/* Taxes */}
            <div className="space-y-2">
              <label className={labelClass}>Taxes</label>
              <Input
                value={taxes}
                onChange={(e) => setTaxes(e.target.value)}
                placeholder="e.g. GST applicable"
                className={inputClass}
              />
            </div>

            {/* Registration Charge */}
            <div className="space-y-2">
              <label className={labelClass}>Registration Charge</label>
              <Input
                value={registrationCharge}
                onChange={(e) => setRegistrationCharge(e.target.value)}
                placeholder="e.g. 1%"
                className={inputClass}
              />
            </div>

            {/* Mode of Payment */}
            <div className="space-y-2">
              <label className={labelClass}>Mode of Payment</label>
              <Input
                value={modeOfPayment}
                onChange={(e) => setModeOfPayment(e.target.value)}
                placeholder="e.g. Bank Transfer"
                className={inputClass}
              />
            </div>

            {/* Time for Registration */}
            <div className="space-y-2">
              <label className={labelClass}>Time for Registration</label>
              <Input
                value={timeForRegistration}
                onChange={(e) => setTimeForRegistration(e.target.value)}
                placeholder="e.g. 30 days"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Location ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* City */}
            <div className="space-y-2">
              <label className={labelClass}>City</label>
              <FormSelect
                name="cityId"
                placeholder="Select City"
                options={formData.cities.map((c) => ({
                  value: String(c.id),
                  label: c.cityName,
                }))}
                value={cityId || null}
                onValueChange={handleCityChange}
              />
            </div>

            {/* Locality */}
            <div className="space-y-2">
              <label className={labelClass}>Locality</label>
              <FormSelect
                name="sublocationId"
                placeholder={cityId ? "Select Locality" : "Select a city first"}
                options={filteredSublocations.map((s) => ({
                  value: String(s.id),
                  label: s.localityName,
                }))}
                value={sublocationId || null}
                onValueChange={setSublocationId}
                disabled={!cityId || filteredSublocations.length === 0}
              />
            </div>

            {/* Pincode */}
            <div className="space-y-2">
              <label className={labelClass}>Pincode</label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 600001"
                className={inputClass}
              />
            </div>

            {/* Full Address */}
            <div className="space-y-2 lg:col-span-3">
              <label className={labelClass}>Full Address</label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full property address"
                rows={3}
                className="rounded-xl bg-muted/30 resize-none"
              />
            </div>

            {/* Latitude */}
            <div className="space-y-2">
              <label className={labelClass}>Latitude</label>
              <Input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 13.0827"
                className={inputClass}
              />
            </div>

            {/* Longitude */}
            <div className="space-y-2">
              <label className={labelClass}>Longitude</label>
              <Input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 80.2707"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Details ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Bedrooms */}
            <div className="space-y-2">
              <label className={labelClass}>Bedrooms</label>
              <Input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                placeholder="e.g. 3"
                min={0}
                className={inputClass}
              />
            </div>

            {/* Bathrooms */}
            <div className="space-y-2">
              <label className={labelClass}>Bathrooms</label>
              <Input
                type="number"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="e.g. 2"
                min={0}
                className={inputClass}
              />
            </div>

            {/* Area */}
            <div className="space-y-2">
              <label className={labelClass}>Area</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={areaSqft}
                  onChange={(e) => setAreaSqft(e.target.value)}
                  placeholder="e.g. 1500"
                  min={0}
                  className={`${inputClass} flex-1`}
                />
                <FormSelect
                  name="areaUnit"
                  placeholder="Unit"
                  options={[
                    { label: "Sq Ft", value: "Sq Ft" },
                    { label: "Sq M", value: "Sq M" },
                    { label: "Acres", value: "Acres" },
                    { label: "Cents", value: "Cents" }
                  ]}
                  value={areaUnit || null}
                  onValueChange={setAreaUnit}
                />
              </div>
            </div>

            {/* Furnishing Status */}
            <div className="space-y-2">
              <label className={labelClass}>Furnishing Status</label>
              <FormSelect
                name="furnishingStatus"
                placeholder="Select Furnishing"
                options={FURNISHING_STATUS_OPTIONS}
                value={furnishingStatus || null}
                onValueChange={setFurnishingStatus}
              />
            </div>

            {/* Furnished (boolean kept for backward compat) */}
            <div className="space-y-2">
              <label className={labelClass}>Furnished</label>
              <div className={checkboxRowClass}>
                <Checkbox
                  id="furnished"
                  checked={furnished}
                  onCheckedChange={(checked) => setFurnished(!!checked)}
                />
                <label htmlFor="furnished" className="text-sm font-semibold cursor-pointer flex-1">
                  Property is furnished
                </label>
              </div>
            </div>

            {/* Facing Direction */}
            <div className="space-y-2">
              <label className={labelClass}>Facing Direction</label>
              <Input
                value={propertyFacing}
                onChange={(e) => setPropertyFacing(e.target.value)}
                placeholder="e.g. East"
                className={inputClass}
              />
            </div>

            {/* Possession Status */}
            <div className="space-y-2">
              <label className={labelClass}>Possession Status</label>
              <FormSelect
                name="possessionStatus"
                placeholder="Select Status"
                options={[
                  { label: "Ready To Move", value: "Ready To Move" },
                  { label: "Under Construction", value: "Under Construction" },
                  { label: "Immediate", value: "Immediate" },
                  { label: "Future Date", value: "Future Date" }
                ]}
                value={possessionStatus || null}
                onValueChange={setPossessionStatus}
              />
            </div>

            {/* Open Sides */}
            <div className="space-y-2">
              <label className={labelClass}>Open Sides</label>
              <Input
                type="number"
                value={openSides}
                onChange={(e) => setOpenSides(e.target.value)}
                placeholder="e.g. 2"
                min={0}
                max={4}
                className={inputClass}
              />
            </div>

            {/* Suitable For */}
            <div className="space-y-2">
              <label className={labelClass}>Suitable For</label>
              <Input
                value={suitableFor}
                onChange={(e) => setSuitableFor(e.target.value)}
                placeholder="e.g. Family, Bachelors"
                className={inputClass}
              />
            </div>

            {/* Age of Property */}
            <div className="space-y-2">
              <label className={labelClass}>Age of Property</label>
              <Input
                value={propertyAge}
                onChange={(e) => setPropertyAge(e.target.value)}
                placeholder="e.g. 5 years"
                className={inputClass}
              />
            </div>

            {/* Floor Number */}
            <div className="space-y-2">
              <label className={labelClass}>Floor Number</label>
              <Input
                value={floorNumber}
                onChange={(e) => setFloorNumber(e.target.value)}
                placeholder="e.g. 4"
                className={inputClass}
              />
            </div>

            {/* Total Floors */}
            <div className="space-y-2">
              <label className={labelClass}>Total Floors</label>
              <Input
                type="number"
                value={totalFloors}
                onChange={(e) => setTotalFloors(e.target.value)}
                placeholder="e.g. 12"
                min={0}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Apartment / Villa / Individual House Details ---- */}
        {["apartment", "villa", "individual_portion"].includes(propertyType) && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              Apartment / Villa Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <div className="space-y-2">
                <label className={labelClass}>Unit Type (2BHK, 3BHK...)</label>
                <Input
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  placeholder="e.g. 3BHK"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Unit Number</label>
                <Input
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="e.g. A-403"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Number of Flats</label>
                <Input
                  type="number"
                  value={numberOfFlats}
                  onChange={(e) => setNumberOfFlats(e.target.value)}
                  placeholder="e.g. 120"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Tower Nos</label>
                <Input
                  type="number"
                  value={towerNos}
                  onChange={(e) => setTowerNos(e.target.value)}
                  placeholder="e.g. 4"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Built Up Area (sqft)</label>
                <Input
                  type="number"
                  value={builtUpArea}
                  onChange={(e) => setBuiltUpArea(e.target.value)}
                  placeholder="e.g. 1350"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Carpet Area (sqft)</label>
                <Input
                  type="number"
                  value={carpetArea}
                  onChange={(e) => setCarpetArea(e.target.value)}
                  placeholder="e.g. 1100"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Super Built Up Area (sqft)</label>
                <Input
                  type="number"
                  value={superBuiltUpArea}
                  onChange={(e) => setSuperBuiltUpArea(e.target.value)}
                  placeholder="e.g. 1500"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>UDS Area (sqft)</label>
                <Input
                  type="number"
                  value={udsArea}
                  onChange={(e) => setUdsArea(e.target.value)}
                  placeholder="e.g. 200"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Plot Area</label>
                <Input
                  value={plotArea}
                  onChange={(e) => setPlotArea(e.target.value)}
                  placeholder="e.g. 2400 sqft"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Balconies</label>
                <Input
                  type="number"
                  value={balconies}
                  onChange={(e) => setBalconies(e.target.value)}
                  placeholder="e.g. 2"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Pooja Room</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="poojaRoom"
                    checked={poojaRoom}
                    onCheckedChange={(checked) => setPoojaRoom(!!checked)}
                  />
                  <label htmlFor="poojaRoom" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Pooja Room
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Study/Store Room</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="studyRoom"
                    checked={studyRoom}
                    onCheckedChange={(checked) => setStudyRoom(!!checked)}
                  />
                  <label htmlFor="studyRoom" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Study / Store Room
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Guest Parking</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="guestParking"
                    checked={guestParking}
                    onCheckedChange={(checked) => setGuestParking(!!checked)}
                  />
                  <label htmlFor="guestParking" className="text-sm font-semibold cursor-pointer flex-1">
                    Guest Parking Available
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Architectural Style</label>
                <Input
                  value={architecturalStyle}
                  onChange={(e) => setArchitecturalStyle(e.target.value)}
                  placeholder="e.g. Contemporary"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Available Portion</label>
                <Input
                  value={availablePortion}
                  onChange={(e) => setAvailablePortion(e.target.value)}
                  placeholder="e.g. Ground Floor"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Outdoor Spaces</label>
                <Input
                  value={outdoorSpaces}
                  onChange={(e) => setOutdoorSpaces(e.target.value)}
                  placeholder="e.g. Terrace, Garden"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Utilities Provided</label>
                <Input
                  value={utilitiesProvided}
                  onChange={(e) => setUtilitiesProvided(e.target.value)}
                  placeholder="e.g. Water, Electricity"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Neighborhood Highlights</label>
                <Input
                  value={neighborhoodHighlights}
                  onChange={(e) => setNeighborhoodHighlights(e.target.value)}
                  placeholder="e.g. Near metro station"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Community Facilities</label>
                <Input
                  value={communityFacilities}
                  onChange={(e) => setCommunityFacilities(e.target.value)}
                  placeholder="e.g. Gym, Pool"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className={labelClass}>Amenities (Apartment specific notes)</label>
                <Textarea
                  value={amenities}
                  onChange={(e) => setAmenities(e.target.value)}
                  placeholder="Any additional amenity notes..."
                  rows={3}
                  className="rounded-xl bg-muted/30 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ---- Plot / Farmland Details ---- */}
        {["plot", "farmland"].includes(propertyType) && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              Plot / Farmland Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <div className="space-y-2">
                <label className={labelClass}>Plot Size (Cents)</label>
                <Input
                  type="number"
                  value={plotSizeCents}
                  onChange={(e) => setPlotSizeCents(e.target.value)}
                  placeholder="e.g. 10"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Plot Nos</label>
                <Input
                  type="number"
                  value={plotNos}
                  onChange={(e) => setPlotNos(e.target.value)}
                  placeholder="e.g. 3"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Zoning / Usage</label>
                <Input
                  value={zoning}
                  onChange={(e) => setZoning(e.target.value)}
                  placeholder="e.g. Residential"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Plot Type</label>
                <Input
                  value={plotType}
                  onChange={(e) => setPlotType(e.target.value)}
                  placeholder="e.g. Corner Plot"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>SF Number</label>
                <Input
                  value={sfNumber}
                  onChange={(e) => setSfNumber(e.target.value)}
                  placeholder="Survey / SF Number"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Land Type</label>
                <Input
                  value={landType}
                  onChange={(e) => setLandType(e.target.value)}
                  placeholder="e.g. Dry Land"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Topography</label>
                <Input
                  value={topography}
                  onChange={(e) => setTopography(e.target.value)}
                  placeholder="e.g. Flat"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Soil Type</label>
                <Input
                  value={soilType}
                  onChange={(e) => setSoilType(e.target.value)}
                  placeholder="e.g. Red Soil"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Irrigation Facilities</label>
                <Input
                  value={irrigation}
                  onChange={(e) => setIrrigation(e.target.value)}
                  placeholder="e.g. Canal"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Fencing</label>
                <Input
                  value={fencing}
                  onChange={(e) => setFencing(e.target.value)}
                  placeholder="e.g. Compound Wall"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Water Sources</label>
                <Input
                  value={waterSources}
                  onChange={(e) => setWaterSources(e.target.value)}
                  placeholder="e.g. Bore well, Canal"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Plot Length</label>
                <Input
                  type="number"
                  value={plotLength}
                  onChange={(e) => setPlotLength(e.target.value)}
                  placeholder="e.g. 60"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Plot Width</label>
                <Input
                  type="number"
                  value={plotWidth}
                  onChange={(e) => setPlotWidth(e.target.value)}
                  placeholder="e.g. 40"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Boundary Wall</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="boundaryWall"
                    checked={boundaryWall}
                    onCheckedChange={(checked) => setBoundaryWall(!!checked)}
                  />
                  <label htmlFor="boundaryWall" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Boundary Wall
                  </label>
                </div>
              </div>

              {/* Farmland-only fields */}
              {propertyType === "farmland" && (
                <>
                  <div className="space-y-2">
                    <label className={labelClass}>Crop Suitability</label>
                    <Input
                      value={cropSuitability}
                      onChange={(e) => setCropSuitability(e.target.value)}
                      placeholder="e.g. Paddy, Sugarcane"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Existing Plantation</label>
                    <Input
                      value={existingPlantation}
                      onChange={(e) => setExistingPlantation(e.target.value)}
                      placeholder="e.g. Mango trees"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Bore Well</label>
                    <div className={checkboxRowClass}>
                      <Checkbox
                        id="boreWell"
                        checked={boreWell}
                        onCheckedChange={(checked) => setBoreWell(!!checked)}
                      />
                      <label htmlFor="boreWell" className="text-sm font-semibold cursor-pointer flex-1">
                        Has Bore Well
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Storage Tank</label>
                    <div className={checkboxRowClass}>
                      <Checkbox
                        id="storageTank"
                        checked={storageTank}
                        onCheckedChange={(checked) => setStorageTank(!!checked)}
                      />
                      <label htmlFor="storageTank" className="text-sm font-semibold cursor-pointer flex-1">
                        Has Storage Tank
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ---- Commercial Space Details ---- */}
        {propertyType === "commercial" && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              Commercial Space Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <div className="space-y-2">
                <label className={labelClass}>Property Use (Office/Retail...)</label>
                <Input
                  value={propertyUse}
                  onChange={(e) => setPropertyUse(e.target.value)}
                  placeholder="e.g. Office"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>No of Lifts</label>
                <Input
                  type="number"
                  value={noOfLifts}
                  onChange={(e) => setNoOfLifts(e.target.value)}
                  placeholder="e.g. 2"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Dimension</label>
                <Input
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value)}
                  placeholder="e.g. 40x60"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Frontage</label>
                <Input
                  value={frontage}
                  onChange={(e) => setFrontage(e.target.value)}
                  placeholder="e.g. 30 ft"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Car Parking</label>
                <Input
                  type="number"
                  value={carParking}
                  onChange={(e) => setCarParking(e.target.value)}
                  placeholder="e.g. 10"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Bike Parking</label>
                <Input
                  type="number"
                  value={bikeParking}
                  onChange={(e) => setBikeParking(e.target.value)}
                  placeholder="e.g. 20"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className={labelClass}>Floors Occupied</label>
                <Input
                  value={floorsOccupied}
                  onChange={(e) => setFloorsOccupied(e.target.value)}
                  placeholder="e.g. Basement, Ground, 1st"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Visitors Parking</label>
                <Input
                  value={visitorsParking}
                  onChange={(e) => setVisitorsParking(e.target.value)}
                  placeholder="e.g. Available"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Ceiling Height (ft)</label>
                <Input
                  type="number"
                  value={ceilingHeightFt}
                  onChange={(e) => setCeilingHeightFt(e.target.value)}
                  placeholder="e.g. 12"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Electricity</label>
                <Input
                  value={electricityConnection}
                  onChange={(e) => setElectricityConnection(e.target.value)}
                  placeholder="e.g. 3 Phase"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Conference Room</label>
                <Input
                  type="number"
                  value={conferenceRoom}
                  onChange={(e) => setConferenceRoom(e.target.value)}
                  placeholder="e.g. 2"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Seater</label>
                <Input
                  type="number"
                  value={seater}
                  onChange={(e) => setSeater(e.target.value)}
                  placeholder="e.g. 50"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Tenant Mix</label>
                <Input
                  value={tenantMix}
                  onChange={(e) => setTenantMix(e.target.value)}
                  placeholder="e.g. IT, Retail"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Outside Parking</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="outsideParking"
                    checked={outsideParking}
                    onCheckedChange={(checked) => setOutsideParking(!!checked)}
                  />
                  <label htmlFor="outsideParking" className="text-sm font-semibold cursor-pointer flex-1">
                    Outside Parking Available
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Fire Safety Compliance</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="fireSafety"
                    checked={fireSafety}
                    onCheckedChange={(checked) => setFireSafety(!!checked)}
                  />
                  <label htmlFor="fireSafety" className="text-sm font-semibold cursor-pointer flex-1">
                    Fire Safety Compliant
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Power Backup</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="powerBackup"
                    checked={powerBackup}
                    onCheckedChange={(checked) => setPowerBackup(!!checked)}
                  />
                  <label htmlFor="powerBackup" className="text-sm font-semibold cursor-pointer flex-1">
                    Power Backup Available
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Air Conditioning</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="hasCentralAc"
                    checked={hasCentralAc}
                    onCheckedChange={(checked) => setHasCentralAc(!!checked)}
                  />
                  <label htmlFor="hasCentralAc" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Air Conditioning
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Pantry</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="hasPantry"
                    checked={hasPantry}
                    onCheckedChange={(checked) => setHasPantry(!!checked)}
                  />
                  <label htmlFor="hasPantry" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Pantry
                  </label>
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className={labelClass}>Amenities (Commercial notes)</label>
                <Textarea
                  value={commercialAmenities}
                  onChange={(e) => setCommercialAmenities(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="rounded-xl bg-muted/30 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ---- Coworking Details ---- */}
        {propertyType === "coworking" && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              Coworking Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <div className="space-y-2">
                <label className={labelClass}>Available Workstations</label>
                <Input
                  type="number"
                  value={availableWorkstations}
                  onChange={(e) => setAvailableWorkstations(e.target.value)}
                  placeholder="e.g. 50"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Private Cabins</label>
                <Input
                  type="number"
                  value={privateCabins}
                  onChange={(e) => setPrivateCabins(e.target.value)}
                  placeholder="e.g. 5"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Available Meeting Rooms</label>
                <Input
                  type="number"
                  value={meetingRooms}
                  onChange={(e) => setMeetingRooms(e.target.value)}
                  placeholder="e.g. 3"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Min Seats</label>
                <Input
                  type="number"
                  value={minSeats}
                  onChange={(e) => setMinSeats(e.target.value)}
                  placeholder="e.g. 1"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Rent per Seat</label>
                <Input
                  type="number"
                  value={rentPerSeat}
                  onChange={(e) => setRentPerSeat(e.target.value)}
                  placeholder="e.g. 8000"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Advance Rent</label>
                <Input
                  type="number"
                  value={advanceRent}
                  onChange={(e) => setAdvanceRent(e.target.value)}
                  placeholder="e.g. 2 months"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Restroom</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="hasRestroom"
                    checked={hasRestroom}
                    onCheckedChange={(checked) => setHasRestroom(!!checked)}
                  />
                  <label htmlFor="hasRestroom" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Restroom
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Lease Term</label>
                <Input
                  value={leaseTerm}
                  onChange={(e) => setLeaseTerm(e.target.value)}
                  placeholder="e.g. Month-to-month"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Incremental Rent Clause</label>
                <Input
                  value={incrementalRent}
                  onChange={(e) => setIncrementalRent(e.target.value)}
                  placeholder="e.g. 5% per year"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Electricity Charges</label>
                <Input
                  value={electricityCharges}
                  onChange={(e) => setElectricityCharges(e.target.value)}
                  placeholder="e.g. Included"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>High Speed Wifi</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="highSpeedWifi"
                    checked={highSpeedWifi}
                    onCheckedChange={(checked) => setHighSpeedWifi(!!checked)}
                  />
                  <label htmlFor="highSpeedWifi" className="text-sm font-semibold cursor-pointer flex-1">
                    High Speed Wifi
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Air Conditioning</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="airConditioning"
                    checked={airConditioning}
                    onCheckedChange={(checked) => setAirConditioning(!!checked)}
                  />
                  <label htmlFor="airConditioning" className="text-sm font-semibold cursor-pointer flex-1">
                    Air Conditioning
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>CCTV Surveillance</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="cctvSurveillance"
                    checked={cctvSurveillance}
                    onCheckedChange={(checked) => setCctvSurveillance(!!checked)}
                  />
                  <label htmlFor="cctvSurveillance" className="text-sm font-semibold cursor-pointer flex-1">
                    CCTV Surveillance
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Power Backup</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="coworkingPowerBackup"
                    checked={coworkingPowerBackup}
                    onCheckedChange={(checked) => setCoworkingPowerBackup(!!checked)}
                  />
                  <label htmlFor="coworkingPowerBackup" className="text-sm font-semibold cursor-pointer flex-1">
                    Power Backup
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Elevator Access</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="elevatorAccess"
                    checked={elevatorAccess}
                    onCheckedChange={(checked) => setElevatorAccess(!!checked)}
                  />
                  <label htmlFor="elevatorAccess" className="text-sm font-semibold cursor-pointer flex-1">
                    Elevator Access
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Pantry</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="coworkingHasPantry"
                    checked={coworkingHasPantry}
                    onCheckedChange={(checked) => setCoworkingHasPantry(!!checked)}
                  />
                  <label htmlFor="coworkingHasPantry" className="text-sm font-semibold cursor-pointer flex-1">
                    Has Pantry
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Security Staff</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="securityStaff"
                    checked={securityStaff}
                    onCheckedChange={(checked) => setSecurityStaff(!!checked)}
                  />
                  <label htmlFor="securityStaff" className="text-sm font-semibold cursor-pointer flex-1">
                    Security Staff Present
                  </label>
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className={labelClass}>Furniture Provided</label>
                <Textarea
                  value={furnitureProvided}
                  onChange={(e) => setFurnitureProvided(e.target.value)}
                  placeholder="e.g. Desks, Chairs, Lockers"
                  rows={3}
                  className="rounded-xl bg-muted/30 resize-none"
                />
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className={labelClass}>Accessibility</label>
                <Textarea
                  value={accessibility}
                  onChange={(e) => setAccessibility(e.target.value)}
                  placeholder="e.g. Wheelchair accessible, Near metro"
                  rows={3}
                  className="rounded-xl bg-muted/30 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ---- Industrial Details ---- */}
        {propertyType === "industrial" && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
              Industrial Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <div className="space-y-2">
                <label className={labelClass}>Building Type</label>
                <Input
                  value={buildingType}
                  onChange={(e) => setBuildingType(e.target.value)}
                  placeholder="e.g. Warehouse"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Property Use</label>
                <Input
                  value={industrialPropertyUse}
                  onChange={(e) => setIndustrialPropertyUse(e.target.value)}
                  placeholder="e.g. Manufacturing"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Covered Area (sqft)</label>
                <Input
                  type="number"
                  value={coveredArea}
                  onChange={(e) => setCoveredArea(e.target.value)}
                  placeholder="e.g. 10000"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Open Area</label>
                <Input
                  type="number"
                  value={openArea}
                  onChange={(e) => setOpenArea(e.target.value)}
                  placeholder="e.g. 5000"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Ceiling Height (ft)</label>
                <Input
                  type="number"
                  value={industrialCeilingHeight}
                  onChange={(e) => setIndustrialCeilingHeight(e.target.value)}
                  placeholder="e.g. 20"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Floor Type</label>
                <Input
                  value={floorType}
                  onChange={(e) => setFloorType(e.target.value)}
                  placeholder="e.g. Epoxy Coated"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Number of Bays</label>
                <Input
                  type="number"
                  value={numberOfBays}
                  onChange={(e) => setNumberOfBays(e.target.value)}
                  placeholder="e.g. 4"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Number of Cabins</label>
                <Input
                  type="number"
                  value={numberOfCabins}
                  onChange={(e) => setNumberOfCabins(e.target.value)}
                  placeholder="e.g. 6"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Power Supply (HP)</label>
                <Input
                  type="number"
                  value={powerSupplyHp}
                  onChange={(e) => setPowerSupplyHp(e.target.value)}
                  placeholder="e.g. 100"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Water Supply</label>
                <Input
                  value={waterSupply}
                  onChange={(e) => setWaterSupply(e.target.value)}
                  placeholder="e.g. Municipal + Bore Well"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Truck Parking</label>
                <Input
                  type="number"
                  value={truckParking}
                  onChange={(e) => setTruckParking(e.target.value)}
                  placeholder="e.g. 5"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Car Parking</label>
                <Input
                  type="number"
                  value={industrialCarParking}
                  onChange={(e) => setIndustrialCarParking(e.target.value)}
                  placeholder="e.g. 20"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Bike Parking</label>
                <Input
                  type="number"
                  value={industrialBikeParking}
                  onChange={(e) => setIndustrialBikeParking(e.target.value)}
                  placeholder="e.g. 30"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Loading/Unloading Bays</label>
                <Input
                  type="number"
                  value={loadingBays}
                  onChange={(e) => setLoadingBays(e.target.value)}
                  placeholder="e.g. 3"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Warehouse Racks</label>
                <Input
                  type="number"
                  value={warehouseRacks}
                  onChange={(e) => setWarehouseRacks(e.target.value)}
                  placeholder="e.g. 20"
                  min={0}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Nearest Highway</label>
                <Input
                  value={nearestHighway}
                  onChange={(e) => setNearestHighway(e.target.value)}
                  placeholder="e.g. NH 44"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Nearest Railway</label>
                <Input
                  value={nearestRailway}
                  onChange={(e) => setNearestRailway(e.target.value)}
                  placeholder="e.g. 5 km"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Nearest Port</label>
                <Input
                  value={nearestPort}
                  onChange={(e) => setNearestPort(e.target.value)}
                  placeholder="e.g. Chennai Port - 30 km"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Nearest Airport</label>
                <Input
                  value={nearestAirport}
                  onChange={(e) => setNearestAirport(e.target.value)}
                  placeholder="e.g. 20 km"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Labour Availability</label>
                <Input
                  value={labourAvailability}
                  onChange={(e) => setLabourAvailability(e.target.value)}
                  placeholder="e.g. Skilled / Unskilled"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Fire Safety Compliance</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="industrialFireSafety"
                    checked={industrialFireSafety}
                    onCheckedChange={(checked) => setIndustrialFireSafety(!!checked)}
                  />
                  <label htmlFor="industrialFireSafety" className="text-sm font-semibold cursor-pointer flex-1">
                    Fire Safety Compliant
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Truck/Trailer Access</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="truckTrailerAccess"
                    checked={truckTrailerAccess}
                    onCheckedChange={(checked) => setTruckTrailerAccess(!!checked)}
                  />
                  <label htmlFor="truckTrailerAccess" className="text-sm font-semibold cursor-pointer flex-1">
                    Truck / Trailer Access
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Crane Available</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="craneAvailable"
                    checked={craneAvailable}
                    onCheckedChange={(checked) => setCraneAvailable(!!checked)}
                  />
                  <label htmlFor="craneAvailable" className="text-sm font-semibold cursor-pointer flex-1">
                    Crane Available
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Power Backup</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="industrialPowerBackup"
                    checked={industrialPowerBackup}
                    onCheckedChange={(checked) => setIndustrialPowerBackup(!!checked)}
                  />
                  <label htmlFor="industrialPowerBackup" className="text-sm font-semibold cursor-pointer flex-1">
                    Power Backup Available
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Heavy Vehicle Access</label>
                <div className={checkboxRowClass}>
                  <Checkbox
                    id="heavyVehicleAccess"
                    checked={heavyVehicleAccess}
                    onCheckedChange={(checked) => setHeavyVehicleAccess(!!checked)}
                  />
                  <label htmlFor="heavyVehicleAccess" className="text-sm font-semibold cursor-pointer flex-1">
                    Heavy Vehicle Access
                  </label>
                </div>
              </div>

              <div className="space-y-2 lg:col-span-3">
                <label className={labelClass}>Worker Facilities</label>
                <Textarea
                  value={workerFacilities}
                  onChange={(e) => setWorkerFacilities(e.target.value)}
                  placeholder="e.g. Canteen, Restrooms, First Aid"
                  rows={3}
                  className="rounded-xl bg-muted/30 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ---- Owner ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Owner</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="space-y-2">
              <label className={labelClass}>Owner Name</label>
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="John Doe"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Owner Phone</label>
              <Input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Owner Email</label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@email.com"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Agent ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Agent</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            <div className="space-y-2">
              <label className={labelClass}>Agent Name</label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Agent Name"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Agency Name</label>
              <Input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Agency Name"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Commission Terms</label>
              <Input
                value={commissionTerms}
                onChange={(e) => setCommissionTerms(e.target.value)}
                placeholder="e.g. 1% of sale value"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Alternate Contact Name</label>
              <Input
                value={alternateName}
                onChange={(e) => setAlternateName(e.target.value)}
                placeholder="Alternate Name"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Alternate Mobile</label>
              <Input
                value={alternatePhone}
                onChange={(e) => setAlternatePhone(e.target.value)}
                placeholder="+91 98765 00000"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Alternate Email</label>
              <Input
                type="email"
                value={alternateEmail}
                onChange={(e) => setAlternateEmail(e.target.value)}
                placeholder="alternate@email.com"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Documents & Verification ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">
            Documents &amp; Verification
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            <div className="space-y-2">
              <label className={labelClass}>Ownership Title Verified</label>
              <Input
                value={ownershipTitleVerified}
                onChange={(e) => setOwnershipTitleVerified(e.target.value)}
                placeholder="N/A / Yes / No"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Encumbrance Certificate</label>
              <Input
                value={encumbranceCertificate}
                onChange={(e) => setEncumbranceCertificate(e.target.value)}
                placeholder="e.g. Available"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Rental Agreement Draft</label>
              <Input
                value={rentalAgreementDraft}
                onChange={(e) => setRentalAgreementDraft(e.target.value)}
                placeholder="e.g. Ready"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>TSLR / FMB</label>
              <Input
                value={tslrFmb}
                onChange={(e) => setTslrFmb(e.target.value)}
                placeholder="e.g. Available"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Tax Receipt</label>
              <Input
                value={taxReceipt}
                onChange={(e) => setTaxReceipt(e.target.value)}
                placeholder="e.g. Up to date"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>EB Receipt</label>
              <Input
                value={ebReceipt}
                onChange={(e) => setEbReceipt(e.target.value)}
                placeholder="e.g. Available"
                className={inputClass}
              />
            </div>

            {["plot", "farmland"].includes(propertyType) && (
              <div className="space-y-2">
                <label className={labelClass}>Patta / Chitta</label>
                <Input
                  value={pattaChitta}
                  onChange={(e) => setPattaChitta(e.target.value)}
                  placeholder="e.g. Available"
                  className={inputClass}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className={labelClass}>Approvals</label>
              <Input
                value={approvals}
                onChange={(e) => setApprovals(e.target.value)}
                placeholder="e.g. CMDA Approved"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Finance Facing</label>
              <Input
                value={financeFacing}
                onChange={(e) => setFinanceFacing(e.target.value)}
                placeholder="e.g. Bank Eligible"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Hypothecation</label>
              <Input
                value={hypothecation}
                onChange={(e) => setHypothecation(e.target.value)}
                placeholder="e.g. NIL"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Deviation</label>
              <Input
                value={deviation}
                onChange={(e) => setDeviation(e.target.value)}
                placeholder="e.g. No deviation"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ---- Market Analysis ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Market Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            <div className="space-y-2">
              <label className={labelClass}>Comparative Price</label>
              <Input
                value={comparativePrice}
                onChange={(e) => setComparativePrice(e.target.value)}
                placeholder="e.g. 4800/sqft"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Rental Yield</label>
              <Input
                value={rentalYield}
                onChange={(e) => setRentalYield(e.target.value)}
                placeholder="e.g. 4.5%"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Market Price</label>
              <Input
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                placeholder="e.g. 5200/sqft"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Demand Area</label>
              <Input
                value={demandArea}
                onChange={(e) => setDemandArea(e.target.value)}
                placeholder="e.g. High Demand"
                className={inputClass}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className={labelClass}>Remark</label>
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Additional remarks or notes"
                rows={3}
                className="rounded-xl bg-muted/30 resize-none"
              />
            </div>
          </div>
        </div>

        {/* ---- Images ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Images</h3>

          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFiles}
          />

          {/* Upload area */}
          <div
            onClick={() => imgInputRef.current?.click()}
            className="border-2 border-dashed border-border/60 rounded-xl h-[120px] flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors mb-4"
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-foreground">
              Click to upload images
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              First image will be set as primary
            </span>
          </div>

          {/* Existing images (edit mode) */}
          {existingImages.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Saved Images
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {existingImages.map((img, idx) => (
                  <div
                    key={img.imageKey || img.imageUrl}
                    className="relative border border-border rounded-xl overflow-hidden bg-muted/10 group"
                  >
                    <img
                      src={img.imageUrl}
                      alt={`Saved image ${idx + 1}`}
                      className="w-full h-28 object-cover"
                    />
                    {img.isPrimary && (
                      <span className="absolute top-1.5 left-1.5 bg-[#0052FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setExistingImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploadingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {uploadTotalCount - uploadingCount + 1} of {uploadTotalCount}...
            </div>
          )}

          {/* Thumbnails */}
          {uploadedImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {uploadedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="relative border border-border rounded-xl overflow-hidden bg-muted/10 group"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.fileName}
                    className="w-full h-28 object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-[#0052FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center transition-colors"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="px-2 py-1.5">
                    <p className="text-xs text-muted-foreground truncate" title={img.fileName}>
                      {img.fileName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Master Amenities ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Amenities</h3>
          {formData.amenities.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No amenities available in the master list.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {formData.amenities.map((amenity: any) => (
                <label
                  key={amenity.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    amenityIds.includes(amenity.id)
                      ? "bg-[#0052FF]/5 border-[#0052FF]/30"
                      : "bg-muted/10 border-border/40 hover:bg-muted/30"
                  }`}
                >
                  <Checkbox
                    checked={amenityIds.includes(amenity.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setAmenityIds((prev) => [...prev, amenity.id]);
                      else setAmenityIds((prev) => prev.filter((id) => id !== amenity.id));
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate" title={amenity.name}>
                      {amenity.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                      {amenity.category || "General"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ---- Floor Plans & Rooms ---- */}
        {!["plot", "farmland"].includes(propertyType) && (
          <div className="bg-card border rounded-2xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Room Dimensions</h3>
            <div className="space-y-4">
              {roomDimensions.map((room, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={room.name}
                      onChange={(e) => {
                        const newRooms = [...roomDimensions];
                        newRooms[idx].name = e.target.value;
                        setRoomDimensions(newRooms);
                      }}
                      placeholder="Room Name (e.g. Master Bedroom)"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={room.dimensions}
                      onChange={(e) => {
                        const newRooms = [...roomDimensions];
                        newRooms[idx].dimensions = e.target.value;
                        setRoomDimensions(newRooms);
                      }}
                      placeholder="Dimensions (e.g. 12x14 ft)"
                      className={inputClass}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const newRooms = [...roomDimensions];
                      newRooms.splice(idx, 1);
                      setRoomDimensions(newRooms);
                    }}
                    className="mt-1 h-10 w-10 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoomDimensions([...roomDimensions, { name: "", dimensions: "" }])}
                className="w-full border-dashed border-2 h-12"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Room Dimension
              </Button>
            </div>
          </div>
        )}

        {/* ---- Localities (Connectivity) ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Connectivity & Localities</h3>
          <div className="space-y-4">
            {connectivity.map((conn, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="w-1/4 space-y-2">
                  <FormSelect
                    name={`connIcon-${idx}`}
                    placeholder="Icon"
                    options={[
                      { label: "Bus", value: "bus" },
                      { label: "Train", value: "train" },
                      { label: "Plane", value: "plane" },
                      { label: "Navigation", value: "navigation" },
                      { label: "Map Pin", value: "map-pin" },
                    ]}
                    value={conn.icon || null}
                    onValueChange={(v) => {
                      const newConn = [...connectivity];
                      newConn[idx].icon = v;
                      setConnectivity(newConn);
                    }}
                  />
                </div>
                <div className="w-1/3 space-y-2">
                  <Input
                    value={conn.label}
                    onChange={(e) => {
                      const newConn = [...connectivity];
                      newConn[idx].label = e.target.value;
                      setConnectivity(newConn);
                    }}
                    placeholder="Label (e.g. Highway)"
                    className={inputClass}
                  />
                </div>
                <div className="w-1/3 space-y-2">
                  <Input
                    value={conn.detail}
                    onChange={(e) => {
                      const newConn = [...connectivity];
                      newConn[idx].detail = e.target.value;
                      setConnectivity(newConn);
                    }}
                    placeholder="Distance (e.g. 5 mins away)"
                    className={inputClass}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const newConn = [...connectivity];
                    newConn.splice(idx, 1);
                    setConnectivity(newConn);
                  }}
                  className="mt-1 h-10 w-10 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setConnectivity([...connectivity, { icon: "navigation", label: "", detail: "" }])}
              className="w-full border-dashed border-2 h-12"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Connectivity Highlight
            </Button>
          </div>
        </div>

        {/* ---- FAQs ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">FAQs</h3>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="flex gap-4 items-start p-4 border rounded-xl bg-muted/5 relative">
                <div className="flex-1 space-y-4">
                  <Input
                    value={faq.question}
                    onChange={(e) => {
                      const newFaqs = [...faqs];
                      newFaqs[idx].question = e.target.value;
                      setFaqs(newFaqs);
                    }}
                    placeholder="Question"
                    className={inputClass}
                  />
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => {
                      const newFaqs = [...faqs];
                      newFaqs[idx].answer = e.target.value;
                      setFaqs(newFaqs);
                    }}
                    placeholder="Answer"
                    rows={2}
                    className="rounded-xl bg-muted/30 resize-none"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const newFaqs = [...faqs];
                    newFaqs.splice(idx, 1);
                    setFaqs(newFaqs);
                  }}
                  className="shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 h-10 w-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setFaqs([...faqs, { question: "", answer: "", section: "overview" }])}
              className="w-full border-dashed border-2 h-12"
            >
              <Plus className="h-4 w-4 mr-2" /> Add FAQ
            </Button>
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DOC_SLOTS.map(({ key, label }) => {
              const doc = documents[key];
              const busy = uploadingDoc === key;
              return (
                <div key={key} className="space-y-2">
                  <label className={labelClass}>{label}</label>
                  <input
                    ref={(el) => { docInputRefs.current[key] = el; }}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (e.target) e.target.value = "";
                      if (f) handleDocFile(key, f);
                    }}
                  />
                  {doc ? (
                    <div className="flex items-center justify-between gap-2 h-12 rounded-xl bg-muted/30 border border-border/60 px-3">
                      <a
                        href={doc.fileUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => { if (!doc.fileUrl) e.preventDefault(); }}
                        className="text-sm font-medium text-foreground truncate hover:text-[#0052FF] hover:underline"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </a>
                      <button
                        type="button"
                        onClick={() => setDocuments((prev) => ({ ...prev, [key]: null }))}
                        className="shrink-0 h-6 w-6 rounded-full bg-black/10 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => docInputRefs.current[key]?.click()}
                      className="w-full h-12 rounded-xl border-2 border-dashed border-border/60 hover:bg-muted/30 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      {busy ? "Uploading..." : `Upload ${label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---- Description ---- */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 mb-6">Description</h3>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the property, key features, surroundings, etc."
            rows={5}
            className="rounded-xl bg-muted/30 resize-none"
          />
        </div>

        {/* ---- Actions ---- */}
        <div className="flex justify-between mt-8 border-t pt-6 border-border/40 pb-10">
          <Button
            type="button"
            variant="outline"
            className="h-12 px-6 rounded-xl font-medium shadow-sm hover:bg-muted"
            onClick={() => router.push("/properties")}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isLoading || uploadingCount > 0}
            className="h-12 px-8 rounded-xl bg-[#0052FF] hover:bg-[#0052FF]/90 font-medium shadow-md"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "create" ? "Create Property" : "Update Property"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
