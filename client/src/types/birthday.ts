export interface AccountMeInfo {
  user_id: string;
  name: string;
  address: string;
  cell: string;
  nodes: { id: number; name: string; full_name: string }[];
}

export interface BirthdayEmployee {
  name: string;
  employeeId: string;
  department: string;
  birthday: string;
  email: string;
  status: string;
  employmentType: string;
}

export interface BirthdayResponse {
  data: BirthdayEmployee[];
  month: number;
  count: number;
}
