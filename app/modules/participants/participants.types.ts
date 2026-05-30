export type Participant = {
  id: string;
  name: string;
  canJoinRemotely: boolean;
  comment: string;
  availableCandidateIds: string[];
  createdAt: string;
  updatedAt: string;
};
