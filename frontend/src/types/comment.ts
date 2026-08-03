export interface Comment {
  id: number;
  content: string;
  username: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export interface CommunityPost {
  id: number;
  title: string;
  content: string;
  username: string;
  reply_count: number;
  created_at: string;
}

export interface CommunityReply {
  id: number;
  content: string;
  username: string;
  created_at: string;
  is_owner: boolean;
}

export interface CommunityPostDetail extends CommunityPost {
  replies: CommunityReply[];
  is_owner: boolean;
}

export interface CommunityPostsResponse {
  posts: CommunityPost[];
  total: number;
  page: number;
  total_pages: number;
}
