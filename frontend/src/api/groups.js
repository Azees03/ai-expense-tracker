import client from "./client";

export const groupAPI = {
  getAll:       ()             => client.get("/groups"),
  getOne:       (id)           => client.get(`/groups/${id}`),
  create:       (data)         => client.post("/groups", data),
  addMember:    (id, email)    => client.post(`/groups/${id}/members`, { email }),
  addExpense:   (id, data)     => client.post(`/groups/${id}/expenses`, data),
  getBalances:  (id)           => client.get(`/groups/${id}/balances`),
  addSettlement:(id, data)     => client.post(`/groups/${id}/settlements`, data),
};
