import { AccessTagsMigration } from "back-core";
import AddContactDescription from "./addContactDescription";
import AddContactRole from "./addContactRole";
import AddContactValue from "./addContactValue";
import AddLeadDisabled from "./addLeadDisabled";
import AddLeadFields from "./addLeadFields";
import AddTouchCompanyName from "./addTouchCompanyName";
import AddTouchOutreachId from "./addTouchOutreachId";
import CampaignWorkflows from "./campaignWorkflows";
import CreateContacts from "./createContacts";
import CreateLeadAudiences from "./createLeadAudiences";
import CreateLeadEvents from "./createLeadEvents";
import CreateLead from "./createLeads";
import CreateLeadTags from "./createLeadTags";
import CreateOffers from "./createOffers";
import CreateOutreach from "./createOutreach";
import CreateOutreachTargets from "./createOutreachTargets";
import CreateTouch from "./createTouch";
import ExtendCampaignsAndOffers from "./extendCampaignsAndOffers";
import NamedLeadTags from "./namedLeadTags";
import FillTouchIds from "./fillTouchIds";

// One relation for the whole store. It covers the four objects that are
// somebody's — leads, tags, offers and campaigns — and nothing else: contacts,
// touches, events, tag links and campaign targets are reached only through one
// of those four and answer to its tags, the way `request_processing` answers to
// its request in `rp-requests`. Listed last, after every table it is joined
// against exists.
export default [
	CreateLead,
	CreateContacts,
	CreateTouch,
	AddContactValue,
	AddContactRole,
	AddLeadFields,
	AddLeadDisabled,
	AddContactDescription,
	CreateLeadTags,
	CreateOffers,
	FillTouchIds,
	CreateLeadEvents,
	AddTouchCompanyName,
	CreateOutreach,
	CreateOutreachTargets,
	AddTouchOutreachId,
	CreateLeadAudiences,
	ExtendCampaignsAndOffers,
	NamedLeadTags,
	CampaignWorkflows,
	AccessTagsMigration,
];
