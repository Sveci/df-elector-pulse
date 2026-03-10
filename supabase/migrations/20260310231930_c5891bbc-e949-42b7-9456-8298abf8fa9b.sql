
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public contact form)
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users with super_admin role can read
CREATE POLICY "Super admins can read contact submissions"
  ON public.contact_submissions
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
  );

-- Super admins can update (mark as read)
CREATE POLICY "Super admins can update contact submissions"
  ON public.contact_submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
  );
