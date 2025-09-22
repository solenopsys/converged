import { TableView } from "converged-core";
import mailingService from "../service";
import { CreateWidget, CreateAction, present } from 'converged-core';
import { sample } from "effector";
import { PaginationParams } from "converged-core";
import { credentialsColumns } from "./columns";
import domain from "../domain";
import { createTableStore } from "converged-core";

const GET_CREDENTIALS = "credentials.get";
const SHOW_CREDENTIALS = "credentials.show";
const SHOW_CREDENTIAL_DETAIL = "credential_detail.show";
const listCredentialsFx = domain.createEffect<PaginationParams, any>({name:'LIST_CREDENTIALS', handler: async (params: PaginationParams) => {
  return await mailingService.listCredentials(params);
}});

const openCredentialDetailFx = domain.createEffect<any, any>({name:'OPEN_CREDENTIAL_DETAIL', handler: async (params: any) => {
  return await mailingService.openCredentialDetail(params);
}});
const openCredentialDetail = domain.createEvent<{ credentialId: string }>('OPEN_CREDENTIAL_DETAIL_EVENT');
const listCredentialsRequest = domain.createEvent<{ page?: number; after?: string }>('LIST_CREDENTIALS_REQUEST_EVENT');

sample({ clock: openCredentialDetail, target: openCredentialDetailFx });
sample({ clock: listCredentialsRequest, target: listCredentialsFx });

const $outMailStore = createTableStore(domain, listCredentialsFx);


const createCredentialsWidget: CreateWidget<typeof TableView> = () => ({
  view: TableView,
  placement: () => "center",
  config: { 
    columns: credentialsColumns,
    title: "Users",
    store:  $outMailStore, 
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100]
   }, 
  commands: {
    rowClick: ({ id }) => openCredentialDetail({ credentialId: id }),
    loadPage: ({ page, after }) => listCredentialsRequest({ page, after })
  }
});

const createGetCredentialsAction: CreateAction<any> = () => ({
  id: GET_CREDENTIALS,
  description: "Get credentials list",
  invoke: ({ page, after }) =>  { listCredentialsRequest({ page, after })}
});

const createShowCredentialsAction: CreateAction<any> = (bus) => ({
  id: SHOW_CREDENTIALS,
  description: "Show credentials list",
  invoke: () => {
    listCredentialsRequest({ page: 1, after: "" });
    bus.present(createCredentialsWidget(bus));
  }
});

const createShowCredentialDetailAction: CreateAction<any> = () => ({
  id: SHOW_CREDENTIAL_DETAIL,
  description: "Show credential details",
  invoke: ({ credentialId }) => {
    openCredentialDetail({ credentialId });
  }
});

const ACTIONS = [
  createGetCredentialsAction,
  createShowCredentialsAction,
  createShowCredentialDetailAction
];

export {
  GET_CREDENTIALS,
  SHOW_CREDENTIALS,
  SHOW_CREDENTIAL_DETAIL,
  createGetCredentialsAction,
  createShowCredentialsAction,
  createShowCredentialDetailAction,
  openCredentialDetail,
  listCredentialsRequest
};

export default ACTIONS;