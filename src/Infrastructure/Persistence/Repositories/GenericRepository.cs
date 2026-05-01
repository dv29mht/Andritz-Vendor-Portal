using AndritzVendorPortal.Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace AndritzVendorPortal.Infrastructure.Persistence.Repositories;

public class GenericRepository<T>(ApplicationDbContext db) : IGenericRepository<T> where T : class
{
    protected readonly ApplicationDbContext Db = db;
    protected readonly DbSet<T> Set = db.Set<T>();

    public virtual async Task<T?> GetByIdAsync(int id, CancellationToken ct = default) =>
        await Set.FindAsync([id], ct);

    public virtual async Task<IReadOnlyList<T>> ListAllAsync(CancellationToken ct = default) =>
        await Set.AsNoTracking().ToListAsync(ct);

    public virtual async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default) =>
        await Set.Where(predicate).AsNoTracking().ToListAsync(ct);

    public virtual async Task<T> AddAsync(T entity, CancellationToken ct = default)
    {
        await Set.AddAsync(entity, ct);
        return entity;
    }

    public virtual void Update(T entity) => Set.Update(entity);
    public virtual void Remove(T entity) => Set.Remove(entity);

    public virtual async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null, CancellationToken ct = default) =>
        predicate is null
            ? await Set.CountAsync(ct)
            : await Set.CountAsync(predicate, ct);
}
