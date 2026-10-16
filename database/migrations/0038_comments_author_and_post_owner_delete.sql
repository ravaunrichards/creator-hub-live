-- Creator Hub Live: allow comment authors and post owners to remove comments.
-- RLS remains the authorization boundary; clients can only delete rows allowed by this policy.
DROP POLICY IF EXISTS comments_del ON public.comments;

CREATE POLICY comments_del
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (
    chcn_my_account_active()
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.posts AS p
        WHERE p.id = comments.post_id
          AND p.author_id = auth.uid()
      )
    )
  );
