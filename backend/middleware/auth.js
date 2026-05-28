import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env variable is required');

const rolePermissions = {
    admin: new Set(['*', 'system:write', 'system:read', 'animal:write', 'animal:read', 'agenda:write', 'agenda:read', 'geofence:write', 'geofence:read']),
    operator: new Set(['system:read', 'animal:read', 'agenda:write', 'agenda:read', 'geofence:read']),
    viewer: new Set(['system:read', 'animal:read', 'agenda:read', 'geofence:read']),
};

const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice(7);
};

const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const resolveUser = (payload) => ({
    id: payload.id || payload.userId || payload.sub || '',
    role: normalizeRole(payload.role || 'viewer'),
    username: payload.username || payload.email || 'anonymous',
    email: payload.email,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
});

const canAccess = (user, requirement) => {
    const role = normalizeRole(user?.role);
    const normalizedRequirement = normalizeRole(requirement);

    if (!normalizedRequirement) {
        return true;
    }

    if (role === normalizedRequirement) {
        return true;
    }

    if (role === 'admin' || role === 'super_admin') {
        return true;
    }

    const permissions = rolePermissions[role] || new Set(user?.permissions || []);
    return permissions.has('*') || permissions.has(normalizedRequirement);
};

export const authenticate = (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = resolveUser(decoded);
        req.token = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
};

export const requireRole = (role) => (req, res, next) => {
    if (!canAccess(req.user, role)) {
        return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
};

export const authorize = (...requirements) => (req, res, next) => {
    if (!requirements.length) {
        return next();
    }

    const allowed = requirements.every((requirement) => canAccess(req.user, requirement));
    if (!allowed) {
        return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
};

export default authenticate;
