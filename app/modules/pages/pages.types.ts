export type Page = {
  id: string;
  ownerName: string;
  editPasswordHash?: string;
  description: string;
  place: string;
  expiresAt: string;
  status: PageStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export enum PageStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  EXPIRED = "EXPIRED",
  DELETED = "DELETED",
}
