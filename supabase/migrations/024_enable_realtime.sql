-- Enable Realtime replication for bid board tables
ALTER TABLE public.bids REPLICA IDENTITY FULL;
ALTER TABLE public.bid_line_items REPLICA IDENTITY FULL;
ALTER TABLE public.bid_clients REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_line_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bid_clients;
