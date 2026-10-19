-- Creator Hub Live: allow comment authors and post owners to remove comments.
-- Keep authorization tied to Supabase's authenticated identity; do not call a
-- Creator Hub Creator Network helper that does not exist in this project.
DROP POLICY IF EXISTS comments_del ON public.comments;

CREATE POLICY comments_del
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.posts AS p
      WHERE p.id = comments.post_id
        AND p.author_id = auth.uid()
    )
  );
